// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/lib/prisma/client";
import { createTestDb } from "@/test/testDb";
import { createNotifier, type PushMessage } from "./notifier.server";

let testDb: ReturnType<typeof createTestDb>;
let db: PrismaClient;
let pushed: { endpoint: string; message: PushMessage }[];
let failEndpoints: Set<string>;

const push = async (
	subscription: { endpoint: string },
	message: PushMessage,
) => {
	if (failEndpoints.has(subscription.endpoint)) throw new Error("410 Gone");
	pushed.push({ endpoint: subscription.endpoint, message });
};

const notifier = () => createNotifier({ db, debounceMs: 5000, push });

// One user with one subscribed device and the given settings.
const subscriber = async (
	name: string,
	settings: { newAppointment: boolean; changedAppointment: boolean },
) => {
	const user = await db.user.create({ data: { name, userName: name } });
	const subscription = await db.subscription.create({
		data: {
			auth: `auth-${name}`,
			device: "Test",
			endpoint: `https://push.test/${name}`,
			p256dh: `p256-${name}`,
			userId: user.id,
		},
	});
	await db.notificationSettings.create({
		data: { ...settings, subscriptionId: subscription.id, userId: user.id },
	});
	return user;
};

const appointment = (labelIds: string[] = []) =>
	db.appointment.create({
		data: {
			labels: { create: labelIds.map((labelId) => ({ labelId })) },
			startDate: new Date("2026-12-01"),
			title: "Bezirksmeisterschaft",
			type: "TOURNAMENT",
		},
	});

// Lets a fire-and-forget send that is not due yet prove it stayed silent.
const flush = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
	await new Promise((r) => setImmediate(r));
};

beforeEach(() => {
	testDb = createTestDb();
	db = testDb.prisma;
	pushed = [];
	failEndpoints = new Set();
});

afterEach(async () => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	await db.$disconnect();
	testDb.close();
});

describe("Notifier.published", () => {
	it("pushes a 'new appointment' message to every opted-in user except the actor", async () => {
		const actor = await subscriber("actor", {
			changedAppointment: true,
			newAppointment: true,
		});
		await subscriber("anna", {
			changedAppointment: false,
			newAppointment: true,
		});
		await subscriber("ben", {
			changedAppointment: true,
			newAppointment: false,
		});
		const appt = await appointment();

		notifier().published(appt, actor.id);
		await vi.waitFor(() => expect(pushed).toHaveLength(1));

		expect(pushed[0].endpoint).toBe("https://push.test/anna");
		expect(pushed[0].message).toMatchObject({
			body: "Bezirksmeisterschaft",
			url: `/appts/${appt.id}`,
		});
	});

	it("skips users who muted one of the appointment's labels", async () => {
		const label = await db.label.create({
			data: { color: "red", name: "Kreis" },
		});
		const muted = await subscriber("muted", {
			changedAppointment: true,
			newAppointment: true,
		});
		await db.userMutedLabel.create({
			data: { labelId: label.id, userId: muted.id },
		});
		await subscriber("anna", {
			changedAppointment: true,
			newAppointment: true,
		});

		notifier().published(await appointment([label.id]), null);
		await vi.waitFor(() => expect(pushed).toHaveLength(1));
		expect(pushed[0].endpoint).toBe("https://push.test/anna");
	});

	it("logs a failed push, keeps delivering to the others and never throws", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await subscriber("gone", {
			changedAppointment: true,
			newAppointment: true,
		});
		await subscriber("anna", {
			changedAppointment: true,
			newAppointment: true,
		});
		failEndpoints.add("https://push.test/gone");

		expect(() =>
			notifier().published({ id: "x", title: "T" }, null),
		).not.toThrow();
		await vi.waitFor(() => expect(error).toHaveBeenCalled());
		expect(pushed.map((p) => p.endpoint)).toEqual(["https://push.test/anna"]);
	});
});

describe("Notifier.updated", () => {
	it("collapses a burst of updates into one push after the debounce, as the latest actor", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const first = await subscriber("first", {
			changedAppointment: true,
			newAppointment: false,
		});
		const second = await subscriber("second", {
			changedAppointment: true,
			newAppointment: false,
		});
		const appt = await appointment();
		const n = notifier();

		n.updated(appt, first.id);
		vi.advanceTimersByTime(4000);
		n.updated({ ...appt, title: "Renamed" }, second.id);
		vi.advanceTimersByTime(4999);
		await flush();
		expect(pushed).toEqual([]);

		vi.advanceTimersByTime(1);
		await vi.waitFor(() => expect(pushed).toHaveLength(1));
		// The latest save's actor is excluded; the earlier one is notified.
		expect(pushed[0].endpoint).toBe("https://push.test/first");
		expect(pushed[0].message.body).toBe("Renamed");
	});

	it("sends nothing once cancelled", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		await subscriber("anna", {
			changedAppointment: true,
			newAppointment: false,
		});
		const appt = await appointment();
		const n = notifier();

		n.updated(appt, null);
		n.cancelUpdated(appt.id);
		vi.advanceTimersByTime(10_000);
		await flush();
		expect(pushed).toEqual([]);
	});
});

describe("Notifier.test", () => {
	it("pushes a test message to every subscription and awaits delivery", async () => {
		await subscriber("anna", {
			changedAppointment: false,
			newAppointment: false,
		});
		await subscriber("ben", {
			changedAppointment: false,
			newAppointment: false,
		});

		await notifier().test();
		expect(pushed.map((p) => p.endpoint).sort()).toEqual([
			"https://push.test/anna",
			"https://push.test/ben",
		]);
	});

	it("rejects when a push fails", async () => {
		await subscriber("gone", {
			changedAppointment: false,
			newAppointment: false,
		});
		failEndpoints.add("https://push.test/gone");
		await expect(notifier().test()).rejects.toThrow("410 Gone");
	});
});

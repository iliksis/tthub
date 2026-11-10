// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestApi } from "@/test/testApi";
import { ApiError, ForbiddenError, NotFoundError } from "./kernel.server";
import { NotificationsApi } from "./notifications.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (
	role: Parameters<typeof createTestApi>[1]["role"] = "USER",
) => {
	const t = await createTestApi(NotificationsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type T = Awaited<ReturnType<typeof setup>>;

const browserSubscription = (key: string): PushSubscriptionJSON => ({
	endpoint: `https://push.test/${key}`,
	keys: { auth: `auth-${key}`, p256dh: `p256-${key}` },
});

// A subscription owned by another user.
const othersSubscription = async (db: T["db"]) => {
	const other = await db.user.create({
		data: { name: "Other", userName: "other" },
	});
	return db.subscription.create({
		data: {
			auth: "auth-other",
			device: "Other phone",
			endpoint: "https://push.test/other",
			p256dh: "p256-other",
			userId: other.id,
		},
	});
};

describe("NotificationsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(NotificationsApi.policy).toMatchInlineSnapshot(`
			{
			  "createSubscription": "AUTHENTICATED",
			  "deleteSubscription": "AUTHENTICATED",
			  "mutedLabels": "AUTHENTICATED",
			  "sendTest": "ADMIN",
			  "settings": "AUTHENTICATED",
			  "subscriptionByAuthKey": "AUTHENTICATED",
			  "subscriptions": "AUTHENTICATED",
			  "updateMutedLabels": "AUTHENTICATED",
			  "updateSettings": "AUTHENTICATED",
			}
		`);
	});

	it("denies anonymous callers subscribing and writes nothing", async () => {
		const { api, db } = await setup(null);
		await expect(
			api.createSubscription({
				device: "Phone",
				subscription: browserSubscription("a"),
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.subscription.count()).toBe(0);
	});

	it("denies a USER sending a test push to every device", async () => {
		const { api, notifications } = await setup("USER");
		await expect(api.sendTest()).rejects.toBeInstanceOf(ForbiddenError);
		expect(notifications).toEqual([]);
	});
});

describe("NotificationsApi subscriptions", () => {
	it("creates a subscription for the actor and finds it by auth key", async () => {
		const { api, user } = await setup();
		const created = await api.createSubscription({
			device: "Android - Chrome",
			subscription: browserSubscription("a"),
		});
		expect(created).toMatchObject({
			auth: "auth-a",
			device: "Android - Chrome",
			endpoint: "https://push.test/a",
			p256dh: "p256-a",
			userId: user?.id,
		});
		expect(await api.subscriptionByAuthKey("auth-a")).toEqual(created);
	});

	it("rejects a browser subscription without keys", async () => {
		const { api, db } = await setup();
		await expect(
			api.createSubscription({
				device: "Phone",
				subscription: { endpoint: "https://push.test/x" },
			}),
		).rejects.toBeInstanceOf(ApiError);
		expect(await db.subscription.count()).toBe(0);
	});

	it("throws NotFoundError for an unknown auth key", async () => {
		const { api } = await setup();
		await expect(api.subscriptionByAuthKey("nope")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});

	it("lists only the actor's own subscriptions", async () => {
		const { api, db } = await setup();
		await othersSubscription(db);
		await api.createSubscription({
			device: "Mine",
			subscription: browserSubscription("mine"),
		});
		expect((await api.subscriptions()).map((s) => s.device)).toEqual(["Mine"]);
	});

	it("deletes an own subscription together with its settings", async () => {
		const { api, db } = await setup();
		const sub = await api.createSubscription({
			device: "Phone",
			subscription: browserSubscription("a"),
		});
		await api.updateSettings({
			changedAppointment: true,
			newAppointment: true,
			subscriptionId: sub.id,
		});
		await api.deleteSubscription(sub.id);
		expect(await db.subscription.count()).toBe(0);
		expect(await db.notificationSettings.count()).toBe(0);
	});

	it("refuses to delete another user's subscription", async () => {
		const { api, db } = await setup("ADMIN");
		const theirs = await othersSubscription(db);
		await expect(api.deleteSubscription(theirs.id)).rejects.toBeInstanceOf(
			NotFoundError,
		);
		expect(await db.subscription.count()).toBe(1);
	});
});

describe("NotificationsApi settings", () => {
	it("creates, reads and updates the actor's settings for a subscription", async () => {
		const { api, user } = await setup();
		const sub = await api.createSubscription({
			device: "Phone",
			subscription: browserSubscription("a"),
		});
		expect(await api.settings(sub.id)).toBeNull();

		await api.updateSettings({
			changedAppointment: false,
			newAppointment: true,
			subscriptionId: sub.id,
		});
		await api.updateSettings({
			changedAppointment: true,
			newAppointment: false,
			subscriptionId: sub.id,
		});
		expect(await api.settings(sub.id)).toEqual({
			changedAppointment: true,
			newAppointment: false,
			subscriptionId: sub.id,
			userId: user?.id,
		});
	});

	it("replaces the actor's muted labels", async () => {
		const { api, db } = await setup();
		const [a, b] = await Promise.all(
			["A", "B"].map((name) =>
				db.label.create({ data: { color: "red", name } }),
			),
		);
		await api.updateMutedLabels([a.id]);
		expect((await api.mutedLabels()).map((l) => l.name)).toEqual(["A"]);

		await api.updateMutedLabels([b.id]);
		expect((await api.mutedLabels()).map((l) => l.name)).toEqual(["B"]);

		await api.updateMutedLabels([]);
		expect(await api.mutedLabels()).toEqual([]);
	});
});

describe("NotificationsApi test push", () => {
	it("asks the notifier for a test push", async () => {
		const { api, notifications } = await setup("ADMIN");
		await api.sendTest();
		expect(notifications).toEqual([{ kind: "test" }]);
	});
});

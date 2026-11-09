// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { AppointmentType } from "@/lib/prisma/enums";
import { createTestApi } from "@/test/testApi";
import { FeedApi } from "./feed.server";
import { ForbiddenError, NotFoundError } from "./kernel.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(FeedApi, { role });
	cleanup = t.cleanup;
	return t;
};

type Db = Awaited<ReturnType<typeof setup>>["db"];

const appointment = (
	db: Db,
	title: string,
	extra: {
		type?: AppointmentType;
		status?: "DRAFT" | "PUBLISHED";
		deletedAt?: Date;
		day?: number;
	} = {},
) =>
	db.appointment.create({
		data: {
			deletedAt: extra.deletedAt,
			startDate: new Date(2026, 0, extra.day ?? 1),
			status: extra.status ?? "PUBLISHED",
			title,
			type: extra.type ?? "TOURNAMENT",
		},
	});

const titles = (list: { title: string }[]) => list.map((a) => a.title);

describe("FeedApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(FeedApi.policy).toMatchInlineSnapshot(`
			{
			  "forFeed": "PUBLIC",
			  "getConfig": "AUTHENTICATED",
			  "updateConfig": "AUTHENTICATED",
			}
		`);
	});

	it("denies anonymous callers saving a feed config", async () => {
		const { api, db } = await setup(null);
		await expect(
			api.updateConfig({ includeDraftStatus: true }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.feedConfig.count()).toBe(0);
	});
});

describe("FeedApi.forFeed", () => {
	it("throws NotFoundError for an unknown feed token", async () => {
		const { api } = await setup(null);
		await expect(api.forFeed("nope")).rejects.toBeInstanceOf(NotFoundError);
	});

	it("filters by type, drafts, deletion and excluded labels, oldest first", async () => {
		const { api, db } = await setup(null);
		const owner = await db.user.create({
			data: {
				feedConfig: {
					create: {
						includeAppointmentTypes: "TOURNAMENT,HOLIDAY",
						includeDraftStatus: false,
					},
				},
				name: "Feed",
				userName: "feed",
			},
		});
		await appointment(db, "later", { day: 5 });
		await appointment(db, "earlier", { day: 2 });
		await appointment(db, "holiday", { day: 3, type: "HOLIDAY" });
		await appointment(db, "match", { type: "TEAM_MATCH" });
		await appointment(db, "draft", { status: "DRAFT" });
		await appointment(db, "deleted", { deletedAt: new Date() });
		const hidden = await appointment(db, "hidden-label");
		const label = await db.label.create({
			data: { color: "red", name: "Privat", priority: 0 },
		});
		await db.appointmentLabel.create({
			data: { appointmentId: hidden.id, labelId: label.id },
		});

		expect(titles(await api.forFeed(owner.feedId))).toEqual([
			"hidden-label",
			"earlier",
			"holiday",
			"later",
		]);

		await db.feedConfig.update({
			data: { excludeLabelIds: label.id, includeDraftStatus: true },
			where: { userId: owner.id },
		});
		const result = await api.forFeed(owner.feedId);
		expect(titles(result)).toEqual(["draft", "earlier", "holiday", "later"]);
		expect(result[0]).toHaveProperty("labels");
	});

	it("limits to the owner's responses when response types are configured", async () => {
		const { api, db } = await setup(null);
		const owner = await db.user.create({
			data: {
				feedConfig: {
					create: {
						includeAppointmentTypes: "TOURNAMENT",
						includeResponseTypes: "ACCEPT",
					},
				},
				name: "Feed",
				userName: "feed",
			},
		});
		const other = await db.user.create({
			data: { name: "Other", userName: "other" },
		});
		const accepted = await appointment(db, "accepted");
		const declined = await appointment(db, "declined");
		const othersOnly = await appointment(db, "others-only");
		await appointment(db, "unanswered");
		await db.response.createMany({
			data: [
				{
					appointmentId: accepted.id,
					responseType: "ACCEPT",
					userId: owner.id,
				},
				{
					appointmentId: declined.id,
					responseType: "DECLINE",
					userId: owner.id,
				},
				{
					appointmentId: othersOnly.id,
					responseType: "ACCEPT",
					userId: other.id,
				},
			],
		});
		expect(titles(await api.forFeed(owner.feedId))).toEqual(["accepted"]);
	});
});

describe("FeedApi config", () => {
	it("returns defaults before anything is saved", async () => {
		const { api, db, user } = await setup("USER");
		const row = await db.user.findUniqueOrThrow({ where: { id: user?.id } });
		expect(await api.getConfig()).toEqual({
			config: {
				excludeLabelIds: undefined,
				includeAppointmentTypes: undefined,
				includeDraftStatus: false,
				includeResponseTypes: undefined,
			},
			feedId: row.feedId,
		});
	});

	it("saves the actor's own config and reads it back", async () => {
		const { api, db, user } = await setup("USER");
		const config = {
			excludeLabelIds: ["a", "b"],
			includeAppointmentTypes: ["TOURNAMENT" as const],
			includeDraftStatus: true,
			includeResponseTypes: ["ACCEPT" as const, "MAYBE" as const],
		};
		const saved = await api.updateConfig(config);
		expect(saved.config).toEqual(config);
		expect(await api.getConfig()).toEqual(saved);
		const row = await db.feedConfig.findUniqueOrThrow({
			where: { userId: user?.id },
		});
		expect(row.excludeLabelIds).toBe("a,b");

		await api.updateConfig({ includeDraftStatus: false });
		expect(await db.feedConfig.count()).toBe(1);
		expect((await api.getConfig()).config.excludeLabelIds).toBeUndefined();
	});
});

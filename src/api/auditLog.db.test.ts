// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import { AuditLogApi } from "./auditLog.server";
import { ForbiddenError } from "./kernel.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(AuditLogApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

// Two appointments with a few entries each, oldest first: a1 created by Anna,
// a1 updated by Anna, a2 created by nobody (system), a2 deleted by Anna.
const seed = async (db: Db) => {
	const anna = await db.user.create({
		data: { name: "Anna", password: "secret", userName: "anna" },
	});
	const a1 = await db.appointment.create({
		data: {
			location: "Halle",
			startDate: new Date("2026-03-01"),
			title: "Kreismeisterschaft",
			type: "TOURNAMENT",
		},
	});
	const a2 = await db.appointment.create({
		data: {
			deletedAt: new Date(),
			startDate: new Date("2026-04-01"),
			title: "Sommerferien",
			type: "HOLIDAY",
		},
	});
	const entry = (
		n: number,
		action: "CREATE" | "UPDATE" | "DELETE",
		entityId: string,
		userId: string | null,
	) => ({
		action,
		changes:
			action === "UPDATE"
				? { title: { new: "Kreismeisterschaft", old: "KM" } }
				: undefined,
		createdAt: new Date(Date.UTC(2026, 0, n)),
		entityId,
		entityType: "Appointment",
		id: `e${n}`,
		userId,
	});
	await db.auditLog.createMany({
		data: [
			entry(1, "CREATE", a1.id, anna.id),
			entry(2, "UPDATE", a1.id, anna.id),
			entry(3, "CREATE", a2.id, null),
			entry(4, "DELETE", a2.id, anna.id),
		],
	});
	return { a1, a2, anna };
};

describe("AuditLogApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(AuditLogApi.policy).toMatchInlineSnapshot(`
			{
			  "forEntity": "AUTHENTICATED",
			  "page": "EDITOR",
			  "recent": "AUTHENTICATED",
			}
		`);
	});

	it("denies a USER the full journal", async () => {
		const { api } = await setup("USER");
		await expect(api.page({ skip: 0, take: 10 })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});

	it("denies anonymous callers the recent activity", async () => {
		const { api } = await setup(null);
		await expect(api.recent({ take: 5 })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});
});

describe("AuditLogApi.page", () => {
	it("pages entries newest first with their user and resolved entity", async () => {
		const { api, db } = await setup("EDITOR");
		const { a1, a2, anna } = await seed(db);

		const result = await api.page({ skip: 1, take: 2 });
		expect(result.grandTotal).toBe(4);
		expect(result.matchedTotal).toBe(4);
		expect(result.entries.map((e) => e.id)).toEqual(["e3", "e2"]);
		expect(result.entries[0]).toMatchObject({
			entity: { detail: null, name: "Sommerferien" },
			entityId: a2.id,
			user: null,
		});
		expect(result.entries[1]).toMatchObject({
			changes: { title: { new: "Kreismeisterschaft", old: "KM" } },
			entity: { detail: "Halle", name: "Kreismeisterschaft" },
			entityId: a1.id,
			user: { id: anna.id, name: "Anna" },
		});
		expectNoCredentials(result);
	});

	it("filters by action without changing the grand total", async () => {
		const { api, db } = await setup("EDITOR");
		await seed(db);

		const result = await api.page({ action: "CREATE", skip: 0, take: 10 });
		expect(result.entries.map((e) => e.id)).toEqual(["e3", "e1"]);
		expect(result).toMatchObject({ grandTotal: 4, matchedTotal: 2 });
	});

	it("searches by entity title or user name", async () => {
		const { api, db } = await setup("EDITOR");
		await seed(db);

		const byTitle = await api.page({ query: "ferien", skip: 0, take: 10 });
		expect(byTitle.entries.map((e) => e.id)).toEqual(["e4", "e3"]);

		const byUser = await api.page({ query: "Ann", skip: 0, take: 10 });
		expect(byUser.entries.map((e) => e.id)).toEqual(["e4", "e2", "e1"]);
		expect(byUser.matchedTotal).toBe(3);
	});
});

describe("AuditLogApi.recent", () => {
	it("returns the latest entries without changes or user details", async () => {
		const { api, db } = await setup("USER");
		const { a2 } = await seed(db);

		const recent = await api.recent({ take: 2 });
		expect(recent).toEqual([
			{
				action: "DELETE",
				createdAt: new Date(Date.UTC(2026, 0, 4)),
				entity: { name: "Sommerferien" },
				entityId: a2.id,
				entityType: "Appointment",
				id: "e4",
				user: { name: "Anna" },
			},
			{
				action: "CREATE",
				createdAt: new Date(Date.UTC(2026, 0, 3)),
				entity: { name: "Sommerferien" },
				entityId: a2.id,
				entityType: "Appointment",
				id: "e3",
				user: null,
			},
		]);
	});
});

describe("AuditLogApi.forEntity", () => {
	it("lists one entity's entries newest first", async () => {
		const { api, db } = await setup("USER");
		const { a1 } = await seed(db);

		const entries = await api.forEntity("Appointment", a1.id);
		expect(entries.map((e) => e.id)).toEqual(["e2", "e1"]);
		expectNoCredentials(entries);
	});
});

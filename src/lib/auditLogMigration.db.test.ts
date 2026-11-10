// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/testDb";

// The audit-log migration (docs/adr/0005) rebuilds the old Appointment-only
// "Transaction" journal as "AuditLog". Applies the real migrations to a DB
// holding old rows and checks every row survives the copy.

let db: ReturnType<typeof createTestDb>;
afterEach(async () => {
	await db?.prisma.$disconnect();
	db?.close();
});

describe("audit log migration", () => {
	it("copies every Transaction row into AuditLog", async () => {
		db = createTestDb("20261104130000_add_season_statistics");
		db.raw.exec(`
			INSERT INTO User (id, userName, name, role, feedId) VALUES
				('u1', 'anna', 'Anna', 'EDITOR', 'f1'),
				('u2', 'ben', 'Ben', 'ADMIN', 'f2');
			INSERT INTO Appointment (id, createdAt, startDate, title, type) VALUES
				('a1', '2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', 'Kreismeisterschaft', 'TOURNAMENT'),
				('a2', '2026-01-02T00:00:00.000Z', '2026-04-01T00:00:00.000Z', 'Ferien', 'HOLIDAY');
			INSERT INTO "Transaction" (id, createdAt, appointmentId, userId, type, changes) VALUES
				('t1', '2026-01-01T10:00:00.000Z', 'a1', 'u1', 'CREATE', NULL),
				('t2', '2026-01-02T10:00:00.000Z', 'a1', 'u2', 'UPDATE', '{"title":{"old":"KM","new":"Kreismeisterschaft"}}'),
				('t3', '2026-01-03T10:00:00.000Z', 'a2', NULL, 'DELETE', NULL),
				('t4', '2026-01-04T10:00:00.000Z', 'a2', 'u1', 'RESTORE', NULL);
		`);

		db.applyRemaining();

		const rows = await db.prisma.auditLog.findMany({ orderBy: { id: "asc" } });
		expect(rows).toEqual([
			{
				action: "CREATE",
				changes: null,
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
				entityId: "a1",
				entityType: "Appointment",
				id: "t1",
				userId: "u1",
			},
			{
				action: "UPDATE",
				changes: { title: { new: "Kreismeisterschaft", old: "KM" } },
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
				entityId: "a1",
				entityType: "Appointment",
				id: "t2",
				userId: "u2",
			},
			{
				action: "DELETE",
				changes: null,
				createdAt: new Date("2026-01-03T10:00:00.000Z"),
				entityId: "a2",
				entityType: "Appointment",
				id: "t3",
				userId: null,
			},
			{
				action: "RESTORE",
				changes: null,
				createdAt: new Date("2026-01-04T10:00:00.000Z"),
				entityId: "a2",
				entityType: "Appointment",
				id: "t4",
				userId: "u1",
			},
		]);
	});

	it("drops the old table and keeps the user link", async () => {
		db = createTestDb("20261104130000_add_season_statistics");
		db.raw.exec(`
			INSERT INTO User (id, userName, name, role, feedId) VALUES ('u1', 'anna', 'Anna', 'EDITOR', 'f1');
			INSERT INTO Appointment (id, createdAt, startDate, title, type) VALUES
				('a1', '2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', 'KM', 'TOURNAMENT');
			INSERT INTO "Transaction" (id, createdAt, appointmentId, userId, type) VALUES
				('t1', '2026-01-01T10:00:00.000Z', 'a1', 'u1', 'CREATE');
		`);

		db.applyRemaining();

		const tables = db.raw
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all()
			.map((r) => (r as { name: string }).name);
		expect(tables).not.toContain("Transaction");
		await db.prisma.user.delete({ where: { id: "u1" } });
		expect(
			await db.prisma.auditLog.findUniqueOrThrow({ where: { id: "t1" } }),
		).toMatchObject({ userId: null });
	});
});

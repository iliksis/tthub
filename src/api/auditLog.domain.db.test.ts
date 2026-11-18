// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestDb } from "@/test/testDb";
import {
	AuditJournal,
	auditEntriesFor,
	resolveEntities,
	searchEntities,
} from "./auditLog.domain.server";

let db: ReturnType<typeof createTestDb>;
afterEach(async () => {
	await db?.prisma.$disconnect();
	db?.close();
});

const setup = async () => {
	db = createTestDb();
	const user = await db.prisma.user.create({
		data: { name: "Anna", password: "secret", userName: "anna" },
	});
	const appointment = await db.prisma.appointment.create({
		data: {
			location: "Halle",
			startDate: new Date("2026-03-01"),
			title: "Kreismeisterschaft",
			type: "TOURNAMENT",
		},
	});
	return { appointment, prisma: db.prisma, user };
};

describe("AuditJournal", () => {
	it("records a creation by the actor", async () => {
		const { appointment, prisma, user } = await setup();
		await new AuditJournal(prisma, "Appointment", user.id).created(
			appointment.id,
		);
		expect(await prisma.auditLog.findMany()).toEqual([
			expect.objectContaining({
				action: "CREATE",
				changes: null,
				entityId: appointment.id,
				entityType: "Appointment",
				userId: user.id,
			}),
		]);
	});

	it("records a system action without an actor", async () => {
		const { appointment, prisma } = await setup();
		await new AuditJournal(prisma, "Appointment", null).created(appointment.id);
		expect(await prisma.auditLog.findFirstOrThrow()).toMatchObject({
			userId: null,
		});
	});

	it("records an update with the changed fields and extra changes", async () => {
		const { appointment, prisma, user } = await setup();
		const after = { ...appointment, location: "Turnhalle", title: "KM" };
		const changes = await new AuditJournal(
			prisma,
			"Appointment",
			user.id,
		).updated(appointment.id, appointment, after, ["title", "location"], {
			labels: { new: ["Bezirk"], old: [] },
		});

		const expected = {
			labels: { new: ["Bezirk"], old: [] },
			location: { new: "Turnhalle", old: "Halle" },
			title: { new: "KM", old: "Kreismeisterschaft" },
		};
		expect(changes).toEqual(expected);
		expect(await prisma.auditLog.findFirstOrThrow()).toMatchObject({
			action: "UPDATE",
			changes: expected,
			entityId: appointment.id,
			userId: user.id,
		});
	});

	it("writes nothing for an update that changed nothing", async () => {
		const { appointment, prisma, user } = await setup();
		const changes = await new AuditJournal(
			prisma,
			"Appointment",
			user.id,
		).updated(appointment.id, appointment, { ...appointment }, ["title"]);
		expect(changes).toEqual({});
		expect(await prisma.auditLog.count()).toBe(0);
	});

	it("records soft deletes and restores, one entry per entity", async () => {
		const { appointment, prisma, user } = await setup();
		const journal = new AuditJournal(prisma, "Appointment", user.id);
		await journal.softDeleted([appointment.id, "other"]);
		await journal.restored([appointment.id]);

		const rows = await prisma.auditLog.findMany({
			select: { action: true, entityId: true, userId: true },
		});
		expect(rows).toEqual(
			expect.arrayContaining([
				{ action: "DELETE", entityId: appointment.id, userId: user.id },
				{ action: "DELETE", entityId: "other", userId: user.id },
				{ action: "RESTORE", entityId: appointment.id, userId: user.id },
			]),
		);
		expect(rows).toHaveLength(3);
	});
});

describe("auditEntriesFor", () => {
	it("lists one entity's entries newest first, with a credential-free user", async () => {
		const { appointment, prisma, user } = await setup();
		await prisma.auditLog.createMany({
			data: [
				{
					action: "CREATE",
					createdAt: new Date("2026-01-01"),
					entityId: appointment.id,
					entityType: "Appointment",
					userId: user.id,
				},
				{
					action: "UPDATE",
					changes: { title: { new: "b", old: "a" } },
					createdAt: new Date("2026-01-02"),
					entityId: appointment.id,
					entityType: "Appointment",
				},
				{
					action: "CREATE",
					entityId: "someone-else",
					entityType: "Appointment",
				},
			],
		});

		const entries = await auditEntriesFor(
			prisma,
			"Appointment",
			appointment.id,
		);
		expect(entries.map((e) => e.action)).toEqual(["UPDATE", "CREATE"]);
		expect(entries[0].user).toBeNull();
		expect(entries[1].user).toEqual({
			id: user.id,
			name: "Anna",
			role: "USER",
			userName: "anna",
		});
		expectNoCredentials(entries);
	});
});

describe("entity resolution", () => {
	it("resolves appointments to title and location, falling back to the id", async () => {
		const { appointment, prisma } = await setup();
		const resolved = await resolveEntities(prisma, [
			{ entityId: appointment.id, entityType: "Appointment" },
			{ entityId: "gone", entityType: "Appointment" },
			{ entityId: "x1", entityType: "Unknown" },
		]);
		expect(resolved).toEqual([
			{ detail: "Halle", name: "Kreismeisterschaft" },
			{ detail: null, name: "gone" },
			{ detail: null, name: "x1" },
		]);
	});

	it("builds a filter matching entries whose entity matches the query", async () => {
		const { appointment, prisma } = await setup();
		await prisma.auditLog.createMany({
			data: [
				{
					action: "CREATE",
					entityId: appointment.id,
					entityType: "Appointment",
				},
				{ action: "CREATE", entityId: "nope", entityType: "Appointment" },
			],
		});
		const where = await searchEntities(prisma, "meister");
		const rows = await prisma.auditLog.findMany({ where: { OR: where } });
		expect(rows.map((r) => r.entityId)).toEqual([appointment.id]);
	});
});

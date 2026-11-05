// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/testDb";
import { activateSeason, refreshActiveSeasonStatistics } from "./seasons";

const year = 2026;
let db: ReturnType<typeof createTestDb>;
afterEach(async () => {
	// Guarded so a failing createTestDb doesn't mask its own error.
	await db?.prisma.$disconnect();
	db?.close();
});

describe("refreshActiveSeasonStatistics", () => {
	it("recomputes the Active Season and picks up changed Player flags", async () => {
		db = createTestDb();
		const past = await db.prisma.season.create({ data: { name: "past" } });
		const active = await db.prisma.season.create({
			data: { isActive: true, name: "active" },
		});
		await db.prisma.player.create({
			data: {
				gender: "MALE",
				id: "a",
				isEligibleToPlay: false,
				name: "A",
				qttr: 1,
				year: year - 30,
			},
		});
		const before = await refreshActiveSeasonStatistics(db.prisma, year);
		expect(before).toMatchObject({ eligibleCount: 0, seasonId: active.id });

		await db.prisma.player.update({
			data: { isEligibleToPlay: true },
			where: { id: "a" },
		});
		const after = await refreshActiveSeasonStatistics(db.prisma, year);
		expect(after).toMatchObject({
			eligibleCount: 1,
			eligibleMaleCount: 1,
			seasonId: active.id,
		});
		// Only the Active Season is recomputed.
		expect(
			await db.prisma.seasonStatistics.findUnique({
				where: { seasonId: past.id },
			}),
		).toBeNull();
	});

	it("works inside an interactive transaction", async () => {
		db = createTestDb();
		const active = await db.prisma.season.create({
			data: { isActive: true, name: "active" },
		});
		const record = await db.prisma.$transaction((tx) =>
			refreshActiveSeasonStatistics(tx, year),
		);
		expect(record.seasonId).toBe(active.id);
		expect(await db.prisma.seasonStatistics.count()).toBe(1);
	});

	it("throws 'Keine aktive Saison' without an Active Season", async () => {
		db = createTestDb();
		await db.prisma.season.create({ data: { name: "past" } });
		await expect(
			refreshActiveSeasonStatistics(db.prisma, year),
		).rejects.toThrow("Keine aktive Saison");
		expect(await db.prisma.seasonStatistics.count()).toBe(0);
	});
});

const createPlayer = (
	db: ReturnType<typeof createTestDb>,
	id: string,
	isEligibleToPlay: boolean,
) =>
	db.prisma.player.create({
		data: {
			gender: "MALE",
			id,
			isEligibleToPlay,
			name: id,
			qttr: 1,
			year: year - 30,
		},
	});

describe("activateSeason", () => {
	it("gives the outgoing Season its final values and populates the incoming one", async () => {
		db = createTestDb();
		const outgoing = await db.prisma.season.create({
			data: { isActive: true, name: "outgoing" },
		});
		const incoming = await db.prisma.season.create({
			data: { name: "incoming" },
		});
		await createPlayer(db, "a", false);
		await refreshActiveSeasonStatistics(db.prisma, year);
		// Changes since the last refresh must land in the outgoing snapshot.
		await db.prisma.player.update({
			data: { isEligibleToPlay: true },
			where: { id: "a" },
		});
		await createPlayer(db, "b", true);

		const season = await db.prisma.$transaction((tx) =>
			activateSeason(tx, incoming.id, year),
		);

		expect(season).toMatchObject({ id: incoming.id, isActive: true });
		expect(
			await db.prisma.season.findUnique({ where: { id: outgoing.id } }),
		).toMatchObject({ isActive: false });
		const outgoingRecord = await db.prisma.seasonStatistics.findUnique({
			where: { seasonId: outgoing.id },
		});
		expect(outgoingRecord).toMatchObject({
			eligibleCount: 2,
			playerCount: 2,
		});
		const incomingRecord = await db.prisma.seasonStatistics.findUnique({
			where: { seasonId: incoming.id },
		});
		expect(incomingRecord).toMatchObject({
			eligibleCount: 2,
			playerCount: 2,
		});
		expect(incomingRecord?.breakdown).toMatchObject({ total: 2 });
	});

	it("works when no Season was active", async () => {
		db = createTestDb();
		const incoming = await db.prisma.season.create({
			data: { name: "incoming" },
		});
		await createPlayer(db, "a", true);

		const season = await db.prisma.$transaction((tx) =>
			activateSeason(tx, incoming.id, year),
		);

		expect(season).toMatchObject({ id: incoming.id, isActive: true });
		expect(await db.prisma.seasonStatistics.count()).toBe(1);
		expect(
			await db.prisma.seasonStatistics.findUnique({
				where: { seasonId: incoming.id },
			}),
		).toMatchObject({ eligibleCount: 1, playerCount: 1 });
	});

	it("re-activating the Active Season keeps a single, fresh record", async () => {
		db = createTestDb();
		const active = await db.prisma.season.create({
			data: { isActive: true, name: "active" },
		});
		await createPlayer(db, "a", true);

		await db.prisma.$transaction((tx) => activateSeason(tx, active.id, year));

		expect(
			await db.prisma.season.findUnique({ where: { id: active.id } }),
		).toMatchObject({ isActive: true });
		expect(await db.prisma.seasonStatistics.count()).toBe(1);
	});

	it("rolls back activation when the target Season does not exist", async () => {
		db = createTestDb();
		const outgoing = await db.prisma.season.create({
			data: { isActive: true, name: "outgoing" },
		});

		await expect(
			db.prisma.$transaction((tx) => activateSeason(tx, "missing", year)),
		).rejects.toThrow();

		expect(
			await db.prisma.season.findUnique({ where: { id: outgoing.id } }),
		).toMatchObject({ isActive: true });
		expect(await db.prisma.seasonStatistics.count()).toBe(0);
	});

	it("creating a Season adds no statistics record", async () => {
		db = createTestDb();
		await db.prisma.season.create({ data: { name: "new" } });
		expect(await db.prisma.seasonStatistics.count()).toBe(0);
	});
});

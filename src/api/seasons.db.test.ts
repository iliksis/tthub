// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/testDb";
import { refreshActiveSeasonStatistics } from "./seasons";

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

	it("throws 'Keine aktive Saison' without an Active Season", async () => {
		db = createTestDb();
		await db.prisma.season.create({ data: { name: "past" } });
		await expect(
			refreshActiveSeasonStatistics(db.prisma, year),
		).rejects.toThrow("Keine aktive Saison");
		expect(await db.prisma.seasonStatistics.count()).toBe(0);
	});
});

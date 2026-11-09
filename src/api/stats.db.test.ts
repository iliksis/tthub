// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAgeGroupBreakdown } from "@/lib/seasonStatistics";
import { createTestApi } from "@/test/testApi";
import { ForbiddenError } from "./kernel.server";
import { StatsApi } from "./stats.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
	vi.restoreAllMocks();
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(StatsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

const seedSeason = (db: Db, name: string, createdAt: string) =>
	db.season.create({ data: { createdAt: new Date(createdAt), name } });

const seedTournament = (
	db: Db,
	data: {
		id: string;
		seasonId: string | null;
		startDate: string;
		nextAppointmentId?: string;
		deletedAt?: Date;
	},
) =>
	db.appointment.create({
		data: {
			...data,
			startDate: new Date(data.startDate),
			title: `T ${data.id}`,
			type: "TOURNAMENT",
		},
	});

describe("StatsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(StatsApi.policy).toMatchInlineSnapshot(`
			{
			  "breakdown": "AUTHENTICATED",
			  "seasonCountOverview": "AUTHENTICATED",
			  "tournamentSeries": "AUTHENTICATED",
			}
		`);
	});

	it("denies anonymous callers", async () => {
		const { api } = await setup(null);
		await expect(api.seasonCountOverview()).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});
});

describe("StatsApi.seasonCountOverview", () => {
	it("lists every season oldest first, untracked ones with null counts", async () => {
		const { api, db } = await setup("USER");
		const newer = await seedSeason(db, "new", "2026-01-01");
		const older = await seedSeason(db, "old", "2025-01-01");
		await db.seasonStatistics.create({
			data: {
				eligibleCount: 3,
				eligibleFemaleCount: 1,
				eligibleMaleCount: 2,
				playerCount: 5,
				seasonId: older.id,
			},
		});

		expect(await api.seasonCountOverview()).toEqual([
			{
				eligibleCount: 3,
				femaleCount: 1,
				maleCount: 2,
				playerCount: 5,
				seasonId: older.id,
				seasonName: "old",
			},
			{
				eligibleCount: null,
				femaleCount: null,
				maleCount: null,
				playerCount: null,
				seasonId: newer.id,
				seasonName: "new",
			},
		]);
	});
});

describe("StatsApi.breakdown", () => {
	const statistics = (seasonId: string, breakdown: unknown) => ({
		breakdown: breakdown as object,
		eligibleCount: 0,
		eligibleFemaleCount: 0,
		eligibleMaleCount: 0,
		seasonId,
	});

	it("returns a stored breakdown as tracked", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db, "s", "2026-01-01");
		const stored = buildAgeGroupBreakdown(
			[{ gender: "MALE", isEligibleToPlay: true, year: 1990 }],
			2026,
		);
		await db.seasonStatistics.create({ data: statistics(season.id, stored) });

		expect(await api.breakdown(season.id)).toMatchObject({
			...stored,
			computedAt: expect.any(Date),
			tracked: true,
		});
	});

	it.each([
		["no season id", undefined],
		["a season without a record", "missing"],
	])("is untracked and all-zero for %s", async (_, seasonId) => {
		const { api } = await setup("USER");
		expect(await api.breakdown(seasonId)).toMatchObject({
			computedAt: null,
			total: 0,
			tracked: false,
		});
	});

	it("treats a corrupt breakdown as untracked and warns", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db, "s", "2026-01-01");
		await db.seasonStatistics.create({
			data: statistics(season.id, { rows: "nope" }),
		});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		expect(await api.breakdown(season.id)).toMatchObject({ tracked: false });
		expect(warn).toHaveBeenCalledOnce();
	});
});

describe("StatsApi.tournamentSeries", () => {
	it("returns nothing without a season id", async () => {
		const { api } = await setup("USER");
		expect(await api.tournamentSeries(undefined)).toEqual([]);
	});

	it("returns each series touching the season as its whole connected graph", async () => {
		const { api, db } = await setup("USER");
		const past = await seedSeason(db, "2025/26", "2025-01-01");
		const season = await seedSeason(db, "2026/27", "2026-01-01");
		// Two qualifiers (one last season) feed one final this season.
		await seedTournament(db, {
			id: "final",
			seasonId: season.id,
			startDate: "2026-03-01",
		});
		await seedTournament(db, {
			id: "q1",
			nextAppointmentId: "final",
			seasonId: past.id,
			startDate: "2025-11-01",
		});
		await seedTournament(db, {
			id: "q2",
			nextAppointmentId: "final",
			seasonId: season.id,
			startDate: "2026-01-01",
		});
		// A deleted link and a series entirely in another season are left out.
		await seedTournament(db, {
			deletedAt: new Date(),
			id: "gone",
			nextAppointmentId: "final",
			seasonId: season.id,
			startDate: "2026-02-01",
		});
		await seedTournament(db, {
			id: "other",
			seasonId: past.id,
			startDate: "2025-10-01",
		});
		const player = await db.player.create({
			data: { name: "Anna", qttr: 1, year: 2000 },
		});
		await db.placement.createMany({
			data: [
				{
					appointmentId: "final",
					category: "U18",
					placement: "1",
					playerId: player.id,
				},
			],
		});

		const series = await api.tournamentSeries(season.id);
		expect(series).toHaveLength(1);
		expect(series[0].nodes).toEqual([
			{
				appointmentId: "final",
				categories: [
					{
						category: "U18",
						placements: [
							{ placement: "1", playerId: player.id, playerName: "Anna" },
						],
					},
				],
				date: new Date("2026-03-01"),
				isCurrent: true,
				nextId: null,
				previousIds: expect.arrayContaining(["q1", "q2"]),
				seasonLabel: "2026/27",
				title: "T final",
			},
			expect.objectContaining({
				appointmentId: "q2",
				isCurrent: true,
				nextId: "final",
			}),
			expect.objectContaining({
				appointmentId: "q1",
				isCurrent: false,
				seasonLabel: "2025/26",
			}),
		]);
		expect(series[0].nodes[0].previousIds).toHaveLength(2);
	});
});

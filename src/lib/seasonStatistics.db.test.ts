// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/testDb";
import {
	type AgeGroupBreakdown,
	recomputeActiveSeasonStatistics,
	recomputeSeasonStatistics,
} from "./seasonStatistics";

const year = 2026;
let db: ReturnType<typeof createTestDb>;
afterEach(async () => {
	await db.prisma.$disconnect();
	db.close();
});

async function seed() {
	const past = await db.prisma.season.create({ data: { name: "past" } });
	const active = await db.prisma.season.create({
		data: { isActive: true, name: "active" },
	});
	await db.prisma.player.createMany({
		data: [
			{
				gender: "MALE",
				id: "a",
				isEligibleToPlay: true,
				name: "A",
				qttr: 1,
				year: year - 10,
			},
			{
				gender: "FEMALE",
				id: "b",
				isEligibleToPlay: true,
				name: "B",
				qttr: 1,
				year: year - 30,
			},
			{
				gender: null,
				id: "c",
				isEligibleToPlay: true,
				name: "C",
				qttr: 1,
				year: year - 30,
			},
			{
				gender: "MALE",
				id: "d",
				isEligibleToPlay: false,
				name: "D",
				qttr: 1,
				year: year - 30,
			},
		],
	});
	return { active, past };
}

describe("season statistics recompute", () => {
	it("computes counts and breakdown for the Active Season", async () => {
		db = createTestDb();
		const { active } = await seed();
		const record = await recomputeActiveSeasonStatistics(db.prisma, year);
		expect(record).toMatchObject({
			eligibleCount: 3,
			eligibleFemaleCount: 1,
			eligibleMaleCount: 1,
			playerCount: 4,
			seasonId: active.id,
		});
		const breakdown = record?.breakdown as AgeGroupBreakdown;
		expect(breakdown.total).toBe(4);
		expect(breakdown.rows[0]).toMatchObject({ ageGroup: "U11" });
		expect(breakdown.rows[0].eligible.male).toBe(1);
		expect(breakdown.rows[4].notEligible.male).toBe(1);
	});

	it("is idempotent apart from computedAt", async () => {
		db = createTestDb();
		const { active } = await seed();
		const first = await recomputeSeasonStatistics(db.prisma, active.id, year);
		await new Promise((r) => setTimeout(r, 10));
		const second = await recomputeSeasonStatistics(db.prisma, active.id, year);
		const { computedAt: c1, ...rest1 } = first;
		const { computedAt: c2, ...rest2 } = second;
		expect(rest2).toEqual(rest1);
		expect(c2.getTime()).toBeGreaterThan(c1.getTime());
		expect(await db.prisma.seasonStatistics.count()).toBe(1);
	});

	it("is a no-op without an Active Season", async () => {
		db = createTestDb();
		await db.prisma.season.create({ data: { name: "past" } });
		expect(await recomputeActiveSeasonStatistics(db.prisma, year)).toBeNull();
		expect(await db.prisma.seasonStatistics.count()).toBe(0);
	});

	it("leaves a past Season's record untouched", async () => {
		db = createTestDb();
		const { past } = await seed();
		await db.prisma.seasonStatistics.create({
			data: {
				eligibleCount: 7,
				eligibleFemaleCount: 3,
				eligibleMaleCount: 4,
				seasonId: past.id,
			},
		});
		const before = await db.prisma.seasonStatistics.findUnique({
			where: { seasonId: past.id },
		});
		await recomputeActiveSeasonStatistics(db.prisma, year);
		const after = await db.prisma.seasonStatistics.findUnique({
			where: { seasonId: past.id },
		});
		expect(after).toEqual(before);
	});
});

describe("migration backfill", () => {
	it("backfills legacy counts for past Seasons and the all-Player count for the Active Season", async () => {
		const prev = "20261104120000_add_player_flags";
		db = createTestDb(prev);
		const now = new Date().toISOString();
		const r = db.raw;
		r.exec(`
			INSERT INTO Season (id, createdAt, name, isActive) VALUES ('s1', '${now}', 'old', 0), ('s2', '${now}', 'cur', 1), ('s0', '${now}', 'empty', 0);
			INSERT INTO Player (id, createdAt, updatedAt, name, year, qttr, gender) VALUES
			 ('p1','${now}','${now}','1',2000,1,'MALE'),
			 ('p2','${now}','${now}','2',2000,1,'FEMALE'),
			 ('p3','${now}','${now}','3',2000,1,NULL),
			 ('p4','${now}','${now}','4',2000,1,'MALE');
			INSERT INTO Team (id, createdAt, title, seasonId) VALUES ('t1','${now}','T','s1');
			INSERT INTO TeamPlayer (id, teamId, playerId, seasonId) VALUES ('x1','t1','p1','s1'),('x2','t1','p3','s1');
		`);
		const apptCols = r.prepare("PRAGMA table_info(Appointment)").all() as {
			name: string;
			notnull: number;
			dflt_value: unknown;
		}[];
		const required = apptCols
			.filter((c) => c.notnull && c.dflt_value === null)
			.map((c) => c.name);
		const values: Record<string, string> = {
			createdAt: `'${now}'`,
			id: "'ap1'",
			seasonId: "'s1'",
			startDate: `'${now}'`,
			status: "'PUBLISHED'",
			title: "'t'",
			type: "'TOURNAMENT'",
			updatedAt: `'${now}'`,
		};
		const cols = [...new Set([...required, "seasonId"])];
		r.exec(
			`INSERT INTO Appointment (${cols.join(",")}) VALUES (${cols.map((c) => values[c] ?? "'x'").join(",")})`,
		);
		r.exec(
			`INSERT INTO Placement (playerId, appointmentId, category) VALUES ('p1','ap1','c'),('p2','ap1','c')`,
		);
		db.applyRemaining();

		const rows = await db.prisma.seasonStatistics.findMany({
			orderBy: { seasonId: "asc" },
		});
		const by = Object.fromEntries(rows.map((x) => [x.seasonId, x]));
		// p1 (roster+placement), p3 (roster, no gender), p2 (placement)
		expect(by.s1).toMatchObject({
			breakdown: null,
			eligibleCount: 3,
			eligibleFemaleCount: 1,
			eligibleMaleCount: 1,
			playerCount: null,
		});
		expect(by.s0).toMatchObject({ eligibleCount: 0, playerCount: null });
		expect(by.s2).toMatchObject({
			breakdown: null,
			eligibleCount: 0,
			eligibleFemaleCount: 0,
			eligibleMaleCount: 0,
			playerCount: 4,
		});
	});

	it("treats every Season as past when none is active", async () => {
		db = createTestDb("20261104120000_add_player_flags");
		const now = new Date().toISOString();
		db.raw.exec(`
			INSERT INTO Season (id, createdAt, name, isActive) VALUES ('s1', '${now}', 'a', 0), ('s2', '${now}', 'b', 0);
			INSERT INTO Player (id, createdAt, updatedAt, name, year, qttr, gender) VALUES ('p1','${now}','${now}','1',2000,1,'MALE');
		`);
		db.applyRemaining();
		const rows = await db.prisma.seasonStatistics.findMany();
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect(row).toMatchObject({
				breakdown: null,
				eligibleCount: 0,
				playerCount: null,
			});
		}
	});
});

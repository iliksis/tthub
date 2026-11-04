import { describe, expect, it } from "vitest";
import {
	buildAgeGroupBreakdown,
	buildSeasonBreakdown,
	buildSeasonCountOverview,
	isAgeGroupBreakdown,
} from "./seasonStatistics";

const year = 2026;

describe("buildAgeGroupBreakdown", () => {
	it("returns all age groups in fixed order with zero counts when empty", () => {
		const result = buildAgeGroupBreakdown([], year);
		expect(result.total).toBe(0);
		expect(result.rows.map((r) => r.ageGroup)).toEqual([
			"U11",
			"U13",
			"U15",
			"U19",
			"ADULT",
		]);
		for (const row of result.rows) {
			expect(row.eligible).toEqual({ female: 0, male: 0, unknown: 0 });
			expect(row.notEligible).toEqual({ female: 0, male: 0, unknown: 0 });
		}
	});

	it("places players on the age boundaries in the right group", () => {
		const p = (age: number) => ({
			gender: "MALE" as const,
			isEligibleToPlay: true,
			year: year - age,
		});
		const result = buildAgeGroupBreakdown(
			[p(10), p(11), p(12), p(13), p(14), p(15), p(18), p(19)],
			year,
		);
		const counts = result.rows.map((r) => r.eligible.male);
		expect(counts).toEqual([1, 2, 2, 2, 1]);
	});

	it("counts a missing gender as unknown", () => {
		const result = buildAgeGroupBreakdown(
			[{ gender: null, isEligibleToPlay: false, year: year - 30 }],
			year,
		);
		expect(result.rows[4].notEligible).toEqual({
			female: 0,
			male: 0,
			unknown: 1,
		});
	});

	it("splits eligible from not-eligible and the sums match the total", () => {
		const result = buildAgeGroupBreakdown(
			[
				{ gender: "MALE", isEligibleToPlay: true, year: year - 10 },
				{ gender: "MALE", isEligibleToPlay: false, year: year - 10 },
				{ gender: "FEMALE", isEligibleToPlay: true, year: year - 40 },
				{ gender: null, isEligibleToPlay: false, year: year - 40 },
			],
			year,
		);
		expect(result.rows[0].eligible.male).toBe(1);
		expect(result.rows[0].notEligible.male).toBe(1);
		expect(result.rows[4].eligible.female).toBe(1);
		expect(result.rows[4].notEligible.unknown).toBe(1);
		const sum = result.rows.reduce(
			(acc, r) =>
				acc +
				Object.values(r.eligible).reduce((a, b) => a + b, 0) +
				Object.values(r.notEligible).reduce((a, b) => a + b, 0),
			0,
		);
		expect(sum).toBe(4);
		expect(result.total).toBe(4);
	});
});

describe("isAgeGroupBreakdown", () => {
	it("accepts what buildAgeGroupBreakdown produces, also after a JSON round trip", () => {
		const breakdown = buildAgeGroupBreakdown(
			[{ gender: "MALE", isEligibleToPlay: true, year: year - 10 }],
			year,
		);
		expect(isAgeGroupBreakdown(breakdown)).toBe(true);
		expect(isAgeGroupBreakdown(JSON.parse(JSON.stringify(breakdown)))).toBe(
			true,
		);
	});

	it("rejects anything that is not a full five-row breakdown", () => {
		const valid = buildAgeGroupBreakdown([], year);
		const badCounts = structuredClone(valid) as unknown as {
			rows: { eligible: { male: unknown } }[];
		};
		badCounts.rows[0].eligible.male = "1";
		const unknownGroup = structuredClone(valid);
		(unknownGroup.rows[0] as { ageGroup: string }).ageGroup = "U9";
		const wrongOrder = { ...valid, rows: [...valid.rows].reverse() };
		for (const value of [
			null,
			undefined,
			"x",
			42,
			[],
			{},
			{ rows: [], total: 0 },
			{ rows: valid.rows },
			{ ...valid, rows: valid.rows.slice(1) },
			{ ...valid, total: "0" },
			// total must equal the sum of every count
			{ ...valid, total: 5 },
			badCounts,
			unknownGroup,
			wrongOrder,
		]) {
			expect(isAgeGroupBreakdown(value)).toBe(false);
		}
	});
});

describe("buildSeasonBreakdown", () => {
	it("returns a tracked result with the stored breakdown and computedAt", () => {
		const breakdown = buildAgeGroupBreakdown(
			[{ gender: "FEMALE", isEligibleToPlay: false, year: year - 40 }],
			year,
		);
		const computedAt = new Date("2026-11-04T03:00:00Z");
		expect(buildSeasonBreakdown({ breakdown, computedAt })).toEqual({
			...breakdown,
			computedAt,
			tracked: true,
		});
	});

	it("returns an all-zero untracked result for a missing record", () => {
		const result = buildSeasonBreakdown(null);
		expect(result).toEqual({
			...buildAgeGroupBreakdown([], year),
			computedAt: null,
			tracked: false,
		});
		expect(result.rows.map((r) => r.ageGroup)).toEqual([
			"U11",
			"U13",
			"U15",
			"U19",
			"ADULT",
		]);
	});

	it("treats a null or malformed breakdown as untracked but keeps computedAt", () => {
		const computedAt = new Date("2026-11-04T03:00:00Z");
		for (const breakdown of [null, { rows: "nope" }, "garbage"]) {
			const result = buildSeasonBreakdown({ breakdown, computedAt });
			expect(result.tracked).toBe(false);
			expect(result.total).toBe(0);
			expect(result.computedAt).toEqual(computedAt);
		}
	});
});

describe("buildSeasonCountOverview", () => {
	it("maps stored records and treats a missing record as untracked", () => {
		const rows = buildSeasonCountOverview([
			{
				id: "a",
				name: "2023/24",
				statistics: {
					eligibleCount: 5,
					eligibleFemaleCount: 2,
					eligibleMaleCount: 3,
					playerCount: null,
				},
			},
			{ id: "b", name: "2024/25", statistics: null },
			{
				id: "c",
				name: "2025/26",
				statistics: {
					eligibleCount: 6,
					eligibleFemaleCount: 2,
					eligibleMaleCount: 4,
					playerCount: 9,
				},
			},
		]);
		expect(rows).toEqual([
			{
				eligibleCount: 5,
				femaleCount: 2,
				maleCount: 3,
				playerCount: null,
				seasonId: "a",
				seasonName: "2023/24",
			},
			{
				eligibleCount: null,
				femaleCount: null,
				maleCount: null,
				playerCount: null,
				seasonId: "b",
				seasonName: "2024/25",
			},
			{
				eligibleCount: 6,
				femaleCount: 2,
				maleCount: 4,
				playerCount: 9,
				seasonId: "c",
				seasonName: "2025/26",
			},
		]);
	});
});

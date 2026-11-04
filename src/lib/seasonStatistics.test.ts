import { describe, expect, it } from "vitest";
import {
	buildAgeGroupBreakdown,
	buildRosterAgeGroupCounts,
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

describe("buildRosterAgeGroupCounts", () => {
	it("counts a player rostered on several teams once and merges eligibility", () => {
		const a = {
			gender: "MALE" as const,
			id: "a",
			isEligibleToPlay: true,
			year: year - 10,
		};
		const b = {
			gender: "MALE" as const,
			id: "b",
			isEligibleToPlay: false,
			year: year - 10,
		};
		const result = buildRosterAgeGroupCounts([a, a, b], year);
		expect(result.total).toBe(2);
		expect(result.rows[0]).toEqual({
			ageGroup: "U11",
			female: 0,
			male: 2,
			unknown: 0,
		});
	});
});

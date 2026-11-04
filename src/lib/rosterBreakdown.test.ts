import { describe, expect, it } from "vitest";
import { buildRosterBreakdown } from "./rosterBreakdown";

const year = new Date().getFullYear();

describe("buildRosterBreakdown", () => {
	it("returns all age groups in order with zero counts when empty", () => {
		const result = buildRosterBreakdown([]);
		expect(result.total).toBe(0);
		expect(result.rows.map((r) => r.ageGroup)).toEqual([
			"U11",
			"U13",
			"U15",
			"U19",
			"ADULT",
		]);
		expect(result.rows.every((r) => r.male + r.female + r.unknown === 0)).toBe(
			true,
		);
	});

	it("buckets by age group and gender, with null gender as unknown", () => {
		const result = buildRosterBreakdown([
			{ gender: "MALE", id: "a", year: year - 10 },
			{ gender: "FEMALE", id: "b", year: year - 12 },
			{ gender: null, id: "c", year: year - 14 },
			{ gender: "MALE", id: "d", year: year - 18 },
			{ gender: "FEMALE", id: "e", year: year - 40 },
		]);
		const byGroup = Object.fromEntries(result.rows.map((r) => [r.ageGroup, r]));
		expect(byGroup.U11).toMatchObject({ female: 0, male: 1, unknown: 0 });
		expect(byGroup.U13).toMatchObject({ female: 1, male: 0, unknown: 0 });
		expect(byGroup.U15).toMatchObject({ female: 0, male: 0, unknown: 1 });
		expect(byGroup.U19).toMatchObject({ female: 0, male: 1, unknown: 0 });
		expect(byGroup.ADULT).toMatchObject({ female: 1, male: 0, unknown: 0 });
		expect(result.total).toBe(5);
	});

	it("counts a player rostered on several teams once", () => {
		const result = buildRosterBreakdown([
			{ gender: "MALE", id: "a", year: year - 10 },
			{ gender: "MALE", id: "a", year: year - 10 },
		]);
		expect(result.total).toBe(1);
		expect(result.rows[0].male).toBe(1);
	});
});

import { describe, expect, it } from "vitest";
import { applyPlayerFilters } from "./Filters";

const player = (
	name: string,
	flags: { isClubMember: boolean; isEligibleToPlay: boolean },
) => ({ name, qttr: 1000, teams: [], year: 2010, ...flags });

const players = [
	player("A", { isClubMember: true, isEligibleToPlay: true }),
	player("B", { isClubMember: true, isEligibleToPlay: false }),
	player("C", { isClubMember: false, isEligibleToPlay: true }),
	player("D", { isClubMember: false, isEligibleToPlay: false }),
];
const names = (r: { name: string }[]) => r.map((p) => p.name);

describe("applyPlayerFilters flags", () => {
	it("returns everyone without flag filters", () => {
		expect(names(applyPlayerFilters(players, {}))).toEqual([
			"A",
			"B",
			"C",
			"D",
		]);
	});
	it("filters by eligibility yes/no", () => {
		expect(names(applyPlayerFilters(players, { eligible: "yes" }))).toEqual([
			"A",
			"C",
		]);
		expect(names(applyPlayerFilters(players, { eligible: "no" }))).toEqual([
			"B",
			"D",
		]);
	});
	it("filters by club membership yes/no", () => {
		expect(names(applyPlayerFilters(players, { member: "yes" }))).toEqual([
			"A",
			"B",
		]);
		expect(names(applyPlayerFilters(players, { member: "no" }))).toEqual([
			"C",
			"D",
		]);
	});
	it("combines both flag filters", () => {
		expect(
			names(applyPlayerFilters(players, { eligible: "yes", member: "no" })),
		).toEqual(["C"]);
	});
});

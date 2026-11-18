import { describe, expect, it } from "vitest";
import {
	normalizeMyTischtennisId,
	redactFlags,
	redactPlayerFlags,
} from "./players";

const players = [{ id: "a", isClubMember: true, isEligibleToPlay: true }];

describe("redactFlags", () => {
	it("keeps flags for editors and admins", () => {
		expect(redactFlags(players, true)).toEqual(players);
	});
	it("forces both flags to false for everyone else", () => {
		expect(redactFlags(players, false)).toEqual([
			{
				id: "a",
				isClubMember: false,
				isEligibleToPlay: false,
				myTischtennisId: null,
			},
		]);
	});
});

describe("redactPlayerFlags", () => {
	it("also hides the myTischtennis id", () => {
		expect(
			redactPlayerFlags({ myTischtennisId: "NU1" }, false).myTischtennisId,
		).toBeNull();
	});
	it("redacts a single player for non-editors only", () => {
		const p = { id: "a", isClubMember: true, isEligibleToPlay: true };
		expect(redactPlayerFlags(p, true)).toEqual(p);
		expect(redactPlayerFlags(p, false)).toEqual({
			id: "a",
			isClubMember: false,
			isEligibleToPlay: false,
			myTischtennisId: null,
		});
	});
});

describe("normalizeMyTischtennisId", () => {
	it.each([
		["NU123", "NU123"],
		["123", "NU123"],
		[" nu123 ", "NU123"],
		["", null],
		["  ", null],
		[null, null],
		[undefined, null],
		["NU", undefined],
		["abc", undefined],
		["NU12a", undefined],
	])("%j -> %j", (raw, expected) => {
		expect(normalizeMyTischtennisId(raw)).toBe(expected);
	});
});

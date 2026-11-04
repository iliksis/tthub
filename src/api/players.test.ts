import { describe, expect, it } from "vitest";
import { redactFlags, redactPlayerFlags } from "./players";

const players = [{ id: "a", isClubMember: true, isEligibleToPlay: true }];

describe("redactFlags", () => {
	it("keeps flags for editors and admins", () => {
		expect(redactFlags(players, true)).toEqual(players);
	});
	it("forces both flags to false for everyone else", () => {
		expect(redactFlags(players, false)).toEqual([
			{ id: "a", isClubMember: false, isEligibleToPlay: false },
		]);
	});
});

describe("redactPlayerFlags", () => {
	it("redacts a single player for non-editors only", () => {
		const p = { id: "a", isClubMember: true, isEligibleToPlay: true };
		expect(redactPlayerFlags(p, true)).toEqual(p);
		expect(redactPlayerFlags(p, false)).toEqual({
			id: "a",
			isClubMember: false,
			isEligibleToPlay: false,
		});
	});
});

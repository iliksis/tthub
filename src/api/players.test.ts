import { describe, expect, it } from "vitest";
import { redactFlags } from "./players";

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

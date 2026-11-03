import { describe, expect, it } from "vitest";
import { collapseHalves } from "./teamHalf";

const team = (id: string, hinrundeTeamId: string | null = null) => ({
	hinrundeTeamId,
	id,
});

describe("collapseHalves", () => {
	it("keeps unpaired teams untouched", () => {
		const teams = [team("a"), team("b")];
		expect(collapseHalves(teams, (t) => t)).toEqual(teams);
	});

	it("resolves a split pair to the Rückrunde row", () => {
		const hin = team("hin");
		const rueck = team("rueck", "hin");
		expect(collapseHalves([hin, team("x"), rueck], (t) => t)).toEqual([
			team("x"),
			rueck,
		]);
	});

	it("keeps the Hinrunde row when its Rückrunde is not in the list", () => {
		expect(collapseHalves([team("hin")], (t) => t)).toEqual([team("hin")]);
	});

	it("works on wrappers via the team accessor", () => {
		const memberships = [{ team: team("hin") }, { team: team("rueck", "hin") }];
		expect(collapseHalves(memberships, (m) => m.team)).toEqual([
			memberships[1],
		]);
	});
});

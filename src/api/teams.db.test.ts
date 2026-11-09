// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";
import { createTestApi } from "@/test/testApi";
import { ConflictError, ForbiddenError, NotFoundError } from "./kernel.server";
import { TeamsApi } from "./teams.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(TeamsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

const seedSeason = (db: Db, name = "2026/27") =>
	db.season.create({ data: { name } });

const seedTeam = (
	db: Db,
	seasonId: string,
	over: { title?: string; league?: string; clickTTGroupId?: string } = {},
) =>
	db.team.create({
		data: { league: "Kreisliga", seasonId, title: "Herren I", ...over },
	});

const seedPlayer = (db: Db, name = "Anna") =>
	db.player.create({
		data: {
			isClubMember: true,
			isEligibleToPlay: true,
			name,
			qttr: 1500,
			year: 2001,
		},
	});

const addToTeam = (
	db: Db,
	team: { id: string; seasonId: string },
	playerId: string,
) =>
	db.teamPlayer.create({
		data: { playerId, seasonId: team.seasonId, teamId: team.id },
	});

const standingStats = {
	diff: 0,
	draws: 0,
	losses: 0,
	matchesLost: 0,
	matchesWon: 0,
	pointsLost: 0,
	pointsWon: 0,
	undecided: 0,
	wins: 0,
};

// A split squad: Hinrunde + its Rückrunde pair.
const seedPair = async (db: Db, seasonId: string) => {
	const hin = await db.team.create({
		data: { half: "HINRUNDE", seasonId, title: "Herren I" },
	});
	const rueck = await db.team.create({
		data: {
			half: "RUECKRUNDE",
			hinrundeTeamId: hin.id,
			seasonId,
			title: "Herren I",
		},
	});
	return { hin, rueck };
};

describe("TeamsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(TeamsApi.policy).toMatchInlineSnapshot(`
			{
			  "applyRosterChanges": "EDITOR",
			  "cloneFromSeason": "EDITOR",
			  "create": "EDITOR",
			  "createRueckrunde": "EDITOR",
			  "delete": "EDITOR",
			  "get": "AUTHENTICATED",
			  "list": "AUTHENTICATED",
			  "search": "AUTHENTICATED",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies a USER creating a team and writes nothing", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db);
		await expect(
			api.create({ league: "", seasonId: season.id, title: "Herren I" }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.team.count()).toBe(0);
	});

	it("denies anonymous callers listing teams", async () => {
		const { api } = await setup(null);
		await expect(api.list(undefined)).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("TeamsApi reads", () => {
	it("lists a season's teams by title with player counts and standings", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db);
		const other = await seedSeason(db, "2025/26");
		const b = await seedTeam(db, season.id, { title: "Herren II" });
		await seedTeam(db, season.id, { title: "Damen I" });
		await seedTeam(db, other.id, { title: "Alt" });
		await addToTeam(db, b, (await seedPlayer(db)).id);
		await db.standing.createMany({
			data: [
				{ ...standingStats, rank: 2, teamId: b.id, teamName: "Gegner" },
				{ ...standingStats, rank: 1, teamId: b.id, teamName: "Wir" },
			],
		});

		const teams = await api.list(season.id);
		expect(teams.map((t) => t.title)).toEqual(["Damen I", "Herren II"]);
		expect(teams[1]._count.players).toBe(1);
		expect(teams[1].standings.map((s) => s.rank)).toEqual([1, 2]);
	});

	it("searches title or league within a season, at most 10", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db);
		for (let i = 0; i < 11; i++) {
			await seedTeam(db, season.id, { title: `Herren ${i}` });
		}
		await seedTeam(db, season.id, { league: "Bezirksliga", title: "Damen" });

		expect(await api.search(undefined, season.id)).toHaveLength(10);
		expect((await api.search("Bezirk", season.id)).map((t) => t.title)).toEqual(
			["Damen"],
		);
		expect(await api.search("Damen", "other-season")).toEqual([]);
	});

	it("gets a team with roster, active appointments and its pair", async () => {
		const { api, db } = await setup("EDITOR");
		const season = await seedSeason(db);
		const { hin, rueck } = await seedPair(db, season.id);
		const anna = await seedPlayer(db);
		await addToTeam(db, hin, anna.id);
		await db.appointment.createMany({
			data: [
				{
					ownTeamId: hin.id,
					startDate: new Date("2026-02-01"),
					title: "Spiel 2",
					type: "TEAM_MATCH",
				},
				{
					ownTeamId: hin.id,
					startDate: new Date("2026-01-01"),
					title: "Spiel 1",
					type: "TEAM_MATCH",
				},
				{
					deletedAt: new Date(),
					ownTeamId: hin.id,
					startDate: new Date("2026-01-15"),
					title: "Gelöscht",
					type: "TEAM_MATCH",
				},
			],
		});

		const team = await api.get(hin.id);
		expect(team.appointments.map((a) => a.title)).toEqual([
			"Spiel 1",
			"Spiel 2",
		]);
		expect(team.rueckrundeTeam).toEqual({ id: rueck.id, title: "Herren I" });
		expect(team.season.id).toBe(season.id);
		expect(team.players[0].player).toMatchObject({
			isClubMember: true,
			name: "Anna",
		});
	});

	it("hides roster players' Club Member / Playing Eligibility from users", async () => {
		const { api, db } = await setup("USER");
		const season = await seedSeason(db);
		const team = await seedTeam(db, season.id);
		await addToTeam(db, team, (await seedPlayer(db)).id);

		const { players } = await api.get(team.id);
		expect(players[0].player).toMatchObject({
			isClubMember: false,
			isEligibleToPlay: false,
		});
	});

	it("throws NotFoundError for a missing team", async () => {
		const { api } = await setup("USER");
		await expect(api.get("missing")).rejects.toBeInstanceOf(NotFoundError);
		await expect(api.get("missing")).rejects.toThrow(m.teams_team_not_found());
	});
});

describe("TeamsApi mutations", () => {
	it("creates a team, storing an empty click-TT id as null", async () => {
		const { api, db } = await setup("EDITOR");
		const season = await seedSeason(db);
		const team = await api.create({
			clickTTGroupId: "",
			league: "Kreisliga",
			seasonId: season.id,
			title: "Herren I",
		});
		expect(team).toMatchObject({
			clickTTGroupId: null,
			league: "Kreisliga",
			seasonId: season.id,
			title: "Herren I",
		});
		expect(await db.team.count()).toBe(1);
	});

	it("updates a team", async () => {
		const { api, db } = await setup("EDITOR");
		const season = await seedSeason(db);
		const team = await seedTeam(db, season.id);
		const updated = await api.update(team.id, {
			clickTTGroupId: "123",
			league: "Bezirksliga",
			title: "Herren II",
		});
		expect(updated).toMatchObject({
			clickTTGroupId: "123",
			league: "Bezirksliga",
			title: "Herren II",
		});
	});

	it("throws NotFoundError updating a missing team", async () => {
		const { api } = await setup("EDITOR");
		await expect(
			api.update("missing", { league: "", title: "x" }),
		).rejects.toThrow(m.teams_team_not_found());
	});

	describe("createRueckrunde", () => {
		it("pairs a plain team with a new Rückrunde", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const team = await seedTeam(db, season.id);

			const rueck = await api.createRueckrunde(team.id);
			expect(rueck).toMatchObject({
				half: "RUECKRUNDE",
				hinrundeTeamId: team.id,
				seasonId: season.id,
				title: "Herren I",
			});
			expect(
				(await db.team.findUniqueOrThrow({ where: { id: team.id } })).half,
			).toBe("HINRUNDE");
		});

		it("refuses a team that already has a Rückrunde", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const { hin, rueck } = await seedPair(db, season.id);
			for (const id of [hin.id, rueck.id]) {
				await expect(api.createRueckrunde(id)).rejects.toBeInstanceOf(
					ConflictError,
				);
			}
			await expect(api.createRueckrunde(hin.id)).rejects.toThrow(
				m.teams_team_already_has_a_rueckrunde(),
			);
			expect(await db.team.count()).toBe(2);
		});

		it("throws NotFoundError for a missing team", async () => {
			const { api } = await setup("EDITOR");
			await expect(api.createRueckrunde("missing")).rejects.toBeInstanceOf(
				NotFoundError,
			);
		});
	});

	describe("delete", () => {
		it("deletes a team with its roster", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const team = await seedTeam(db, season.id);
			await addToTeam(db, team, (await seedPlayer(db)).id);

			await api.delete(team.id);
			expect(await db.team.count()).toBe(0);
			expect(await db.teamPlayer.count()).toBe(0);
			expect(await db.player.count()).toBe(1);
		});

		it.each(["hin", "rueck"] as const)(
			"unpairs the surviving half when deleting the %s half",
			async (deleted) => {
				const { api, db } = await setup("EDITOR");
				const season = await seedSeason(db);
				const pair = await seedPair(db, season.id);
				const survivor = deleted === "hin" ? pair.rueck : pair.hin;

				await api.delete(pair[deleted].id);
				expect(
					await db.team.findUniqueOrThrow({ where: { id: survivor.id } }),
				).toMatchObject({ half: null, hinrundeTeamId: null });
			},
		);

		it("throws NotFoundError for a missing team", async () => {
			const { api } = await setup("EDITOR");
			await expect(api.delete("missing")).rejects.toThrow(
				m.teams_team_not_found(),
			);
		});
	});

	describe("applyRosterChanges", () => {
		it("adds and removes players on the team", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const team = await seedTeam(db, season.id);
			const anna = await seedPlayer(db, "Anna");
			const bea = await seedPlayer(db, "Bea");
			const membership = await addToTeam(db, team, anna.id);

			await api.applyRosterChanges(team.id, [bea.id], [membership.id]);
			expect(
				await db.teamPlayer.findMany({ where: { teamId: team.id } }),
			).toMatchObject([{ playerId: bea.id, seasonId: season.id }]);
		});

		it("allows a player on the paired half", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const { hin, rueck } = await seedPair(db, season.id);
			const anna = await seedPlayer(db);
			await addToTeam(db, hin, anna.id);

			await api.applyRosterChanges(rueck.id, [anna.id], []);
			expect(await db.teamPlayer.count()).toBe(2);
		});

		it("allows a player who was on a team in another season", async () => {
			const { api, db } = await setup("EDITOR");
			const past = await seedSeason(db, "2025/26");
			const season = await seedSeason(db);
			const anna = await seedPlayer(db);
			await addToTeam(db, await seedTeam(db, past.id), anna.id);
			const team = await seedTeam(db, season.id);

			await api.applyRosterChanges(team.id, [anna.id], []);
			expect(await db.teamPlayer.count({ where: { teamId: team.id } })).toBe(1);
		});

		it.each(["another team this season", "this team"] as const)(
			"refuses a player already on %s and writes nothing",
			async (where) => {
				const { api, db } = await setup("EDITOR");
				const season = await seedSeason(db);
				const team = await seedTeam(db, season.id);
				const other = await seedTeam(db, season.id, { title: "Herren II" });
				const anna = await seedPlayer(db, "Anna");
				const bea = await seedPlayer(db, "Bea");
				const kept = await addToTeam(db, team, bea.id);
				await addToTeam(db, where === "this team" ? team : other, anna.id);

				const result = api.applyRosterChanges(team.id, [anna.id], [kept.id]);
				await expect(result).rejects.toBeInstanceOf(ConflictError);
				await expect(result).rejects.toThrow(
					m.teams_player_is_already_assigned_to_a_team_this_season(),
				);
				// The whole change rolls back, removals included.
				expect(await db.teamPlayer.count({ where: { id: kept.id } })).toBe(1);
			},
		);

		it("only removes memberships of this team", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db);
			const team = await seedTeam(db, season.id);
			const other = await seedTeam(db, season.id, { title: "Herren II" });
			const elsewhere = await addToTeam(db, other, (await seedPlayer(db)).id);

			await api.applyRosterChanges(team.id, [], [elsewhere.id]);
			expect(await db.teamPlayer.count({ where: { id: elsewhere.id } })).toBe(
				1,
			);
		});

		it("throws NotFoundError for a missing team", async () => {
			const { api } = await setup("EDITOR");
			await expect(
				api.applyRosterChanges("missing", [], []),
			).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("cloneFromSeason", () => {
		it("copies teams and rosters without click-TT ids and returns counts", async () => {
			const { api, db } = await setup("EDITOR");
			const source = await seedSeason(db, "2025/26");
			const target = await seedSeason(db);
			const herren = await seedTeam(db, source.id, { clickTTGroupId: "42" });
			await seedTeam(db, source.id, { title: "Damen I" });
			await addToTeam(db, herren, (await seedPlayer(db, "Anna")).id);
			await addToTeam(db, herren, (await seedPlayer(db, "Bea")).id);

			expect(await api.cloneFromSeason(source.id, target.id)).toEqual({
				playersCopied: 2,
				teamsCopied: 2,
			});
			const cloned = await db.team.findMany({
				include: { players: true },
				orderBy: { title: "asc" },
				where: { seasonId: target.id },
			});
			expect(cloned).toMatchObject([
				{ clickTTGroupId: null, players: [], title: "Damen I" },
				{ clickTTGroupId: null, league: "Kreisliga", title: "Herren I" },
			]);
			expect(cloned[1].players).toHaveLength(2);
			expect(cloned[1].players[0].seasonId).toBe(target.id);
		});

		it("refuses a target season that already has teams", async () => {
			const { api, db } = await setup("EDITOR");
			const source = await seedSeason(db, "2025/26");
			const target = await seedSeason(db);
			await seedTeam(db, source.id);
			await seedTeam(db, target.id);

			const result = api.cloneFromSeason(source.id, target.id);
			await expect(result).rejects.toBeInstanceOf(ConflictError);
			await expect(result).rejects.toThrow(
				m.teams_teams_already_exist_in_the_target_season(),
			);
			expect(await db.team.count()).toBe(2);
		});
	});
});

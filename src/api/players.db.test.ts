// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";
import { createTestApi } from "@/test/testApi";
import { ForbiddenError, NotFoundError } from "./kernel.server";
import { type PlayerInput, PlayersApi } from "./players.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(PlayersApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

const input = (over: Partial<PlayerInput> = {}): PlayerInput => ({
	gender: "FEMALE",
	isClubMember: true,
	isEligibleToPlay: true,
	name: "Anna",
	qttr: 1500,
	year: 2001,
	...over,
});

const seedPlayer = (db: Db, over: Partial<PlayerInput> = {}) =>
	db.player.create({ data: input(over) });

// An active and a past Season, a split squad (Hinrunde + Rückrunde) in the
// active one and a team in the past one, all holding `playerId`.
const seedTeams = async (db: Db, playerId: string) => {
	const active = await db.season.create({
		data: { isActive: true, name: "2026/27" },
	});
	const past = await db.season.create({ data: { name: "2025/26" } });
	const hin = await db.team.create({
		data: { half: "HINRUNDE", seasonId: active.id, title: "Herren I" },
	});
	const rueck = await db.team.create({
		data: {
			half: "RUECKRUNDE",
			hinrundeTeamId: hin.id,
			seasonId: active.id,
			title: "Herren I",
		},
	});
	const old = await db.team.create({
		data: { seasonId: past.id, title: "Herren II" },
	});
	for (const team of [hin, rueck, old]) {
		await db.teamPlayer.create({
			data: { playerId, seasonId: team.seasonId, teamId: team.id },
		});
	}
	return { active, hin, old, past, rueck };
};

describe("PlayersApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(PlayersApi.policy).toMatchInlineSnapshot(`
			{
			  "create": "EDITOR",
			  "delete": "EDITOR",
			  "get": "AUTHENTICATED",
			  "list": "AUTHENTICATED",
			  "search": "AUTHENTICATED",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies a USER creating a player and writes nothing", async () => {
		const { api, db } = await setup("USER");
		await expect(api.create(input())).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.player.count()).toBe(0);
	});

	it("denies anonymous callers listing players", async () => {
		const { api } = await setup(null);
		await expect(api.list(undefined)).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("PlayersApi reads", () => {
	it("lists players by name with only the current half of the active season", async () => {
		const { api, db } = await setup("EDITOR");
		const anna = await seedPlayer(db, { name: "Anna" });
		await seedPlayer(db, { name: "Bea" });
		const { rueck } = await seedTeams(db, anna.id);

		const players = await api.list(undefined);
		expect(players.map((p) => p.name)).toEqual(["Anna", "Bea"]);
		expect(players[0].teams.map((tp) => tp.team.id)).toEqual([rueck.id]);
	});

	it("lists a given season's memberships", async () => {
		const { api, db } = await setup("EDITOR");
		const anna = await seedPlayer(db);
		const { old, past } = await seedTeams(db, anna.id);

		const [player] = await api.list(past.id);
		expect(player.teams.map((tp) => tp.team.id)).toEqual([old.id]);
	});

	it("searches by name, at most 10", async () => {
		const { api, db } = await setup("USER");
		for (let i = 0; i < 11; i++) await seedPlayer(db, { name: `Anna ${i}` });
		await seedPlayer(db, { name: "Bea" });
		expect(await api.search(undefined)).toHaveLength(10);
		expect((await api.search("Bea")).map((p) => p.name)).toEqual(["Bea"]);
	});

	it("gets one player with all memberships (newest first) and placements", async () => {
		const { api, db } = await setup("EDITOR");
		const anna = await seedPlayer(db);
		await seedTeams(db, anna.id);
		const appointment = await db.appointment.create({
			data: {
				startDate: new Date("2026-01-01"),
				title: "Turnier",
				type: "TOURNAMENT",
			},
		});
		await db.placement.create({
			data: {
				appointmentId: appointment.id,
				category: "Herren A",
				placement: "1",
				playerId: anna.id,
			},
		});

		const player = await api.get(anna.id);
		expect(player.teams).toHaveLength(3);
		expect(player.teams[0].team.season).toBeDefined();
		expect(player.placements).toMatchObject([
			{ appointment: { title: "Turnier" }, category: "Herren A" },
		]);
	});

	it("throws NotFoundError for a missing player", async () => {
		const { api } = await setup("USER");
		await expect(api.get("missing")).rejects.toBeInstanceOf(NotFoundError);
		await expect(api.get("missing")).rejects.toThrow(
			m.players_player_not_found(),
		);
	});

	it("shows Club Member / Playing Eligibility to editors only", async () => {
		const editor = await setup("EDITOR");
		const p = await seedPlayer(editor.db);
		expect(await editor.api.get(p.id)).toMatchObject({
			isClubMember: true,
			isEligibleToPlay: true,
		});
		expect((await editor.api.list(undefined))[0].isClubMember).toBe(true);
		await editor.cleanup();

		const viewer = await setup("USER");
		const q = await seedPlayer(viewer.db);
		const hidden = { isClubMember: false, isEligibleToPlay: false };
		expect(await viewer.api.get(q.id)).toMatchObject(hidden);
		expect((await viewer.api.list(undefined))[0]).toMatchObject(hidden);
		expect((await viewer.api.search(undefined))[0]).toMatchObject(hidden);
	});
});

describe("PlayersApi mutations", () => {
	it("creates a player, defaulting missing flags to false", async () => {
		const { api, db } = await setup("EDITOR");
		const created = await api.create({
			gender: null,
			name: "Bea",
			qttr: 1200,
			year: 2010,
		});
		expect(created).toMatchObject({
			gender: null,
			isClubMember: false,
			isEligibleToPlay: false,
			name: "Bea",
		});
		expect(await db.player.count()).toBe(1);
	});

	it("updates a player", async () => {
		const { api, db } = await setup("EDITOR");
		const p = await seedPlayer(db);
		const updated = await api.update(p.id, {
			...input(),
			isClubMember: false,
			name: "Anna B.",
			qttr: 1600,
		});
		expect(updated).toMatchObject({ isClubMember: false, name: "Anna B." });
		expect(await db.player.findUnique({ where: { id: p.id } })).toMatchObject({
			name: "Anna B.",
			qttr: 1600,
		});
	});

	it("deletes a player and their team memberships", async () => {
		const { api, db } = await setup("EDITOR");
		const p = await seedPlayer(db);
		await seedTeams(db, p.id);
		await api.delete(p.id);
		expect(await db.player.count()).toBe(0);
		expect(await db.teamPlayer.count()).toBe(0);
	});

	it("throws NotFoundError updating or deleting a missing player", async () => {
		const { api } = await setup("EDITOR");
		await expect(api.update("missing", input())).rejects.toBeInstanceOf(
			NotFoundError,
		);
		await expect(api.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
	});
});

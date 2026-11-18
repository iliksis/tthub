// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";
import { createTestApi } from "@/test/testApi";
import { ConflictError, ForbiddenError, NotFoundError } from "./kernel.server";
import { SeasonsApi } from "./seasons.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(SeasonsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

const seedSeason = (db: Db, name: string, isActive = false) =>
	db.season.create({ data: { isActive, name } });

describe("SeasonsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(SeasonsApi.policy).toMatchInlineSnapshot(`
			{
			  "active": "AUTHENTICATED",
			  "create": "EDITOR",
			  "delete": "EDITOR",
			  "list": "AUTHENTICATED",
			  "listWithCounts": "AUTHENTICATED",
			  "refreshStatistics": "EDITOR",
			  "setActive": "EDITOR",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies a USER creating a season and writes nothing", async () => {
		const { api, db } = await setup("USER");
		await expect(api.create("2026/27")).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.season.count()).toBe(0);
	});

	it("denies anonymous callers listing seasons", async () => {
		const { api } = await setup(null);
		await expect(api.list()).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("SeasonsApi reads", () => {
	it("lists the Active Season first, then newest first", async () => {
		const { api, db } = await setup("USER");
		await db.season.create({
			data: { createdAt: new Date("2024-01-01"), isActive: true, name: "A" },
		});
		await db.season.create({
			data: { createdAt: new Date("2025-01-01"), name: "B" },
		});
		await db.season.create({
			data: { createdAt: new Date("2026-01-01"), name: "C" },
		});
		expect((await api.list()).map((s) => s.name)).toEqual(["A", "C", "B"]);
	});

	it("lists seasons newest first with team and active appointment counts", async () => {
		const { api, db } = await setup("USER");
		const old = await db.season.create({
			data: { createdAt: new Date("2025-01-01"), name: "old" },
		});
		const season = await db.season.create({
			data: { createdAt: new Date("2026-01-01"), name: "new" },
		});
		await db.team.create({ data: { seasonId: season.id, title: "Herren I" } });
		await db.appointment.createMany({
			data: [
				{
					seasonId: season.id,
					startDate: new Date(),
					title: "a",
					type: "TEAM_MATCH",
				},
				{
					deletedAt: new Date(),
					seasonId: season.id,
					startDate: new Date(),
					title: "b",
					type: "TEAM_MATCH",
				},
			],
		});

		const seasons = await api.listWithCounts();
		expect(seasons.map((s) => [s.id, s._count])).toEqual([
			[season.id, { appointments: 1, teams: 1 }],
			[old.id, { appointments: 0, teams: 0 }],
		]);
	});

	it("returns the Active Season, or null without one", async () => {
		const { api, db } = await setup("USER");
		expect(await api.active()).toBeNull();
		const active = await seedSeason(db, "active", true);
		await seedSeason(db, "past");
		expect((await api.active())?.id).toBe(active.id);
	});
});

describe("SeasonsApi mutations", () => {
	it("creates an inactive season", async () => {
		const { api, db } = await setup("EDITOR");
		const season = await api.create("2026/27");
		expect(season).toMatchObject({ isActive: false, name: "2026/27" });
		expect(await db.season.count()).toBe(1);
	});

	it("renames a season", async () => {
		const { api, db } = await setup("EDITOR");
		const season = await seedSeason(db, "old");
		expect(await api.update(season.id, "new")).toMatchObject({ name: "new" });
	});

	it("throws NotFoundError renaming a missing season", async () => {
		const { api } = await setup("EDITOR");
		const result = api.update("missing", "x");
		await expect(result).rejects.toBeInstanceOf(NotFoundError);
		await expect(result).rejects.toThrow(m.seasons_season_not_found());
	});

	describe("setActive", () => {
		it("activates a season and deactivates the previous one", async () => {
			const { api, db } = await setup("EDITOR");
			const previous = await seedSeason(db, "previous", true);
			const next = await seedSeason(db, "next");

			expect(await api.setActive(next.id)).toMatchObject({
				id: next.id,
				isActive: true,
			});
			expect(
				(await db.season.findMany({ where: { isActive: true } })).map(
					(s) => s.id,
				),
			).toEqual([next.id]);
			expect(
				(await db.season.findUniqueOrThrow({ where: { id: previous.id } }))
					.isActive,
			).toBe(false);
		});

		it("throws NotFoundError for a missing season and keeps the Active Season", async () => {
			const { api, db } = await setup("EDITOR");
			const active = await seedSeason(db, "active", true);
			await expect(api.setActive("missing")).rejects.toThrow(
				m.seasons_season_not_found(),
			);
			expect(
				(await db.season.findUniqueOrThrow({ where: { id: active.id } }))
					.isActive,
			).toBe(true);
		});
	});

	describe("delete", () => {
		it("deletes an unreferenced past season", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db, "past");
			await api.delete(season.id);
			expect(await db.season.count()).toBe(0);
		});

		it("refuses the Active Season", async () => {
			const { api, db } = await setup("EDITOR");
			const season = await seedSeason(db, "active", true);
			const result = api.delete(season.id);
			await expect(result).rejects.toBeInstanceOf(ConflictError);
			await expect(result).rejects.toThrow(
				m.seasons_the_active_season_cannot_be_deleted(),
			);
			expect(await db.season.count()).toBe(1);
		});

		it.each(["team", "appointment"] as const)(
			"refuses a season a %s refers to",
			async (kind) => {
				const { api, db } = await setup("EDITOR");
				const season = await seedSeason(db, "past");
				if (kind === "team") {
					await db.team.create({ data: { seasonId: season.id, title: "x" } });
				} else {
					await db.appointment.create({
						data: {
							seasonId: season.id,
							startDate: new Date(),
							title: "x",
							type: "TEAM_MATCH",
						},
					});
				}
				const result = api.delete(season.id);
				await expect(result).rejects.toBeInstanceOf(ConflictError);
				await expect(result).rejects.toThrow(
					m.seasons_cannot_delete_while_referenced(),
				);
				expect(await db.season.count()).toBe(1);
			},
		);

		it("throws NotFoundError for a missing season", async () => {
			const { api } = await setup("EDITOR");
			await expect(api.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("refreshStatistics", () => {
		it("recomputes the Active Season's record", async () => {
			const { api, db } = await setup("EDITOR");
			const past = await seedSeason(db, "past");
			const active = await seedSeason(db, "active", true);
			await db.player.create({
				data: {
					gender: "FEMALE",
					isEligibleToPlay: true,
					name: "A",
					qttr: 1,
					year: 1990,
				},
			});

			const result = await api.refreshStatistics();
			expect(result).toEqual({
				computedAt: expect.any(Date),
				seasonId: active.id,
			});
			expect(
				await db.seasonStatistics.findUniqueOrThrow({
					where: { seasonId: active.id },
				}),
			).toMatchObject({ eligibleCount: 1, eligibleFemaleCount: 1 });
			// Only the Active Season is recomputed; past Seasons stay snapshots.
			expect(
				await db.seasonStatistics.findUnique({ where: { seasonId: past.id } }),
			).toBeNull();
		});

		it("throws NotFoundError without an Active Season and writes nothing", async () => {
			const { api, db } = await setup("EDITOR");
			await seedSeason(db, "past");
			const result = api.refreshStatistics();
			await expect(result).rejects.toBeInstanceOf(NotFoundError);
			await expect(result).rejects.toThrow(m.seasons_no_active_season());
			expect(await db.seasonStatistics.count()).toBe(0);
		});
	});
});

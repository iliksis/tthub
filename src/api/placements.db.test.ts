// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";
import { createTestApi } from "@/test/testApi";
import { ConflictError, ForbiddenError, NotFoundError } from "./kernel.server";
import { PlacementsApi } from "./placements.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(PlacementsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

const seedTournament = async (db: Db) => {
	const appointment = await db.appointment.create({
		data: {
			startDate: new Date("2026-03-01"),
			title: "Kreismeisterschaft",
			type: "TOURNAMENT",
		},
	});
	const player = await db.player.create({
		data: { name: "Anna", qttr: 1500, year: 2001 },
	});
	return { appointmentId: appointment.id, playerId: player.id };
};

const key = (ids: { appointmentId: string; playerId: string }) => ({
	...ids,
	category: "Herren A",
});

describe("PlacementsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(PlacementsApi.policy).toMatchInlineSnapshot(`
			{
			  "categories": "AUTHENTICATED",
			  "create": "EDITOR",
			  "delete": "EDITOR",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies a USER creating a placement and writes nothing", async () => {
		const { api, db } = await setup("USER");
		const ids = await seedTournament(db);
		await expect(api.create(key(ids))).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.placement.count()).toBe(0);
	});

	it("denies anonymous callers listing categories", async () => {
		const { api } = await setup(null);
		await expect(api.categories()).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("PlacementsApi reads", () => {
	it("lists each category once", async () => {
		const { api, db } = await setup("USER");
		const ids = await seedTournament(db);
		const other = await db.player.create({
			data: { name: "Ben", qttr: 1400, year: 2000 },
		});
		await db.placement.createMany({
			data: [
				{ ...ids, category: "Herren A" },
				{ ...ids, category: "Herren B" },
				{ ...ids, category: "Herren A", playerId: other.id },
			],
		});

		expect((await api.categories()).sort()).toEqual(["Herren A", "Herren B"]);
	});
});

describe("PlacementsApi mutations", () => {
	it("creates a placement", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);

		const created = await api.create({ ...key(ids), placement: "1" });
		expect(created).toMatchObject({ ...key(ids), placement: "1" });
		expect(await db.placement.findMany()).toEqual([
			expect.objectContaining({ ...key(ids), placement: "1" }),
		]);
	});

	it("rejects a participant already in the category and keeps the original", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);
		await db.placement.create({ data: { ...key(ids), placement: "2" } });

		const attempt = api.create({ ...key(ids), placement: "1" });
		await expect(attempt).rejects.toBeInstanceOf(ConflictError);
		await expect(attempt).rejects.toThrow(
			m.placements_participant_already_exists_in_this_category(),
		);
		expect(await db.placement.findMany()).toEqual([
			expect.objectContaining({ placement: "2" }),
		]);
	});

	it("updates a placement's rank", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);
		await db.placement.create({ data: { ...key(ids), placement: "2" } });

		const updated = await api.update(key(ids), { placement: "1" });
		expect(updated.placement).toBe("1");
		expect(
			(await db.placement.findFirstOrThrow({ where: key(ids) })).placement,
		).toBe("1");
	});

	it("reports a missing placement on update", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);

		const attempt = api.update(key(ids), { placement: "1" });
		await expect(attempt).rejects.toBeInstanceOf(NotFoundError);
		await expect(attempt).rejects.toThrow(m.placements_placement_not_found());
	});

	it("deletes a placement", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);
		await db.placement.create({ data: key(ids) });
		await db.placement.create({ data: { ...key(ids), category: "Mixed" } });

		const deleted = await api.delete(key(ids));
		expect(deleted).toMatchObject(key(ids));
		expect(await db.placement.findMany()).toEqual([
			expect.objectContaining({ category: "Mixed" }),
		]);
	});

	it("reports a missing placement on delete", async () => {
		const { api, db } = await setup("EDITOR");
		const ids = await seedTournament(db);

		await expect(api.delete(key(ids))).rejects.toBeInstanceOf(NotFoundError);
	});
});

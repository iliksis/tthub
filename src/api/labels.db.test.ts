// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestApi } from "@/test/testApi";
import { ForbiddenError, NotFoundError } from "./kernel.server";
import { LabelsApi } from "./labels.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(LabelsApi, { role });
	cleanup = t.cleanup;
	return t;
};

const priorities = async (db: Awaited<ReturnType<typeof setup>>["db"]) =>
	(await db.label.findMany({ orderBy: { priority: "asc" } })).map((l) => [
		l.name,
		l.priority,
	]);

describe("LabelsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(LabelsApi.policy).toMatchInlineSnapshot(`
			{
			  "create": "EDITOR",
			  "delete": "EDITOR",
			  "list": "AUTHENTICATED",
			  "reorder": "EDITOR",
			  "search": "AUTHENTICATED",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies a USER creating a label and writes nothing", async () => {
		const { api, db } = await setup("USER");
		await expect(
			api.create({ color: "blue", name: "Nope" }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.label.count()).toBe(0);
	});

	it("denies anonymous callers listing labels", async () => {
		const { api } = await setup(null);
		await expect(api.list()).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("LabelsApi reads", () => {
	it("lists in priority order and searches by name (max 10)", async () => {
		const { api } = await setup("EDITOR");
		await api.create({ color: "blue", name: "Bezirk" });
		await api.create({ color: "red", name: "Kreis" });
		for (let i = 0; i < 11; i++) {
			await api.create({ color: "green", name: `Bezirk ${i}` });
		}
		expect((await api.list()).slice(0, 2).map((l) => l.name)).toEqual([
			"Bezirk",
			"Kreis",
		]);
		expect(await api.search(undefined)).toHaveLength(10);
		expect((await api.search("Kreis")).map((l) => l.name)).toEqual(["Kreis"]);
	});
});

describe("LabelsApi mutations", () => {
	it("creates labels at the bottom of the priority list", async () => {
		const { api, db } = await setup("EDITOR");
		const first = await api.create({ color: "blue", name: "A" });
		await api.create({ color: "red", name: "B" });
		expect(first).toMatchObject({ color: "blue", name: "A", priority: 0 });
		expect(await priorities(db)).toEqual([
			["A", 0],
			["B", 1],
		]);
	});

	it("updates name and color", async () => {
		const { api } = await setup("EDITOR");
		const label = await api.create({ color: "blue", name: "Old" });
		const updated = await api.update(label.id, { color: "red", name: "New" });
		expect(updated).toMatchObject({ color: "red", id: label.id, name: "New" });
	});

	it("throws NotFoundError updating or deleting a missing label", async () => {
		const { api } = await setup("EDITOR");
		await expect(
			api.update("missing", { color: "red", name: "x" }),
		).rejects.toBeInstanceOf(NotFoundError);
		await expect(api.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
	});

	it("reorders, appending ids missing from a stale payload and ignoring unknown ones", async () => {
		const { api, db } = await setup("EDITOR");
		const a = await api.create({ color: "blue", name: "A" });
		const b = await api.create({ color: "blue", name: "B" });
		await api.create({ color: "blue", name: "C" });
		await api.reorder([b.id, "gone", a.id]);
		expect(await priorities(db)).toEqual([
			["B", 0],
			["A", 1],
			["C", 2],
		]);
	});

	it("deletes a label and its appointment attachments", async () => {
		const { api, db } = await setup("EDITOR");
		const label = await api.create({ color: "blue", name: "A" });
		const appointment = await db.appointment.create({
			data: {
				labels: { create: [{ labelId: label.id }] },
				startDate: new Date("2026-01-01"),
				title: "Turnier",
				type: "TOURNAMENT",
			},
		});
		await api.delete(label.id);
		expect(await db.label.count()).toBe(0);
		expect(
			await db.appointmentLabel.count({
				where: { appointmentId: appointment.id },
			}),
		).toBe(0);
	});
});

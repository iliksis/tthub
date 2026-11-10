// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportEntity } from "@/importers/types";
import { m } from "@/paraglide/messages";
import { createTestApi } from "@/test/testApi";
import { ImportsApi } from "./imports.server";
import { ForbiddenError, NotFoundError } from "./kernel.server";

// The importer registry is the seam: real importers call external APIs, so
// tests swap in importers that emit a scripted list of entities (or throw).
const fake = vi.hoisted(() => ({
	entities: [] as ImportEntity[],
	failure: null as Error | null,
}));
vi.mock("@/importers/registry.server", () => {
	const importer = {
		configSchema: null,
		description: "Fake",
		id: "fake",
		name: "Fake",
		async run({ emit }: { emit: (e: ImportEntity) => Promise<unknown> }) {
			if (fake.failure) throw fake.failure;
			let imported = 0;
			let skipped = 0;
			for (const entity of fake.entities) {
				const { status } = (await emit(entity)) as { status: string };
				if (status === "imported") imported++;
				else skipped++;
			}
			return { imported, skipped };
		},
		version: "1.0.0",
	};
	return {
		getImporter: (id: string) => (id === "fake" ? importer : undefined),
		listImporters: () => [
			{
				configFields: [],
				description: "Fake",
				id: "fake",
				name: "Fake",
				version: "1.0.0",
			},
		],
	};
});

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	fake.entities = [];
	fake.failure = null;
	vi.restoreAllMocks();
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (
	role: Parameters<typeof createTestApi>[1]["role"] = "EDITOR",
) => {
	const t = await createTestApi(ImportsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type T = Awaited<ReturnType<typeof setup>>;

type EventEntity = Extract<ImportEntity, { type: "event" }>;
const holiday = (
	externalId: string,
	startsAt = "2026-12-24T00:00:00.000Z",
): EventEntity => ({
	appointmentType: "HOLIDAY",
	endsAt: "2026-12-26T00:00:00.000Z",
	externalId,
	startsAt,
	title: `Holiday ${externalId}`,
	type: "event",
});

// Starts an import and waits for its background job to leave "running".
const importAll = async (api: T["api"], entities: ImportEntity[]) => {
	fake.entities = entities;
	const { jobId } = await api.start("fake", {});
	return vi.waitFor(async () => {
		const job = await api.progress(jobId);
		if (job.status === "running") throw new Error("still running");
		return job;
	});
};

describe("ImportsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(ImportsApi.policy).toMatchInlineSnapshot(`
			{
			  "progress": "EDITOR",
			  "setEnabled": "ADMIN",
			  "settings": "EDITOR",
			  "start": "EDITOR",
			}
		`);
	});

	it("denies a USER starting an import and starts nothing", async () => {
		const { api, db } = await setup("USER");
		fake.entities = [holiday("h1")];
		await expect(api.start("fake", {})).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.appointment.count()).toBe(0);
	});

	it("denies an EDITOR toggling an importer and writes nothing", async () => {
		const { api, db } = await setup("EDITOR");
		await expect(api.setEnabled("fake", false)).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(await db.importerSetting.count()).toBe(0);
	});
});

describe("ImportsApi.start", () => {
	it("creates new appointments and journals them as the actor", async () => {
		const { api, db, user } = await setup();
		const job = await importAll(api, [holiday("h1"), holiday("h2")]);

		expect(job).toEqual({
			imported: 2,
			message: m.imports_n_created_n_updated_n_skipped({
				param1: "2",
				param2: "0",
				param3: "0",
			}),
			skipped: 0,
			status: "done",
			updated: 0,
		});
		const created = await db.appointment.findUniqueOrThrow({
			where: { id: "h1" },
		});
		expect(created).toMatchObject({
			endDate: new Date("2026-12-26T00:00:00.000Z"),
			seasonId: null,
			startDate: new Date("2026-12-24T00:00:00.000Z"),
			title: "Holiday h1",
			type: "HOLIDAY",
		});
		const journal = await db.auditLog.findMany({
			orderBy: { entityId: "asc" },
		});
		expect(journal).toMatchObject([
			{
				action: "CREATE",
				entityId: "h1",
				entityType: "Appointment",
				userId: user?.id,
			},
			{
				action: "CREATE",
				entityId: "h2",
				entityType: "Appointment",
				userId: user?.id,
			},
		]);
	});

	it("takes a team match's season from its own team", async () => {
		const { api, db } = await setup();
		const season = await db.season.create({ data: { name: "2026/27" } });
		const team = await db.team.create({
			data: { seasonId: season.id, title: "Herren I" },
		});
		await importAll(api, [
			{
				...holiday("m1"),
				appointmentType: "TEAM_MATCH",
				teamMatch: { awayTeam: "Gast", homeTeam: "Heim", ownTeamId: team.id },
			},
		]);
		expect(
			await db.appointment.findUniqueOrThrow({ where: { id: "m1" } }),
		).toMatchObject({
			awayTeam: "Gast",
			homeTeam: "Heim",
			ownTeamId: team.id,
			seasonId: season.id,
		});
	});

	it("updates a moved start date and skips unchanged ones, journalling only the move", async () => {
		const { api, db, user } = await setup();
		await importAll(api, [holiday("h1"), holiday("h2")]);
		await db.auditLog.deleteMany();

		const job = await importAll(api, [
			holiday("h1", "2026-12-23T00:00:00.000Z"),
			holiday("h2"),
		]);

		expect(job).toMatchObject({ imported: 0, skipped: 1, updated: 1 });
		expect(
			(await db.appointment.findUniqueOrThrow({ where: { id: "h1" } }))
				.startDate,
		).toEqual(new Date("2026-12-23T00:00:00.000Z"));
		expect(await db.auditLog.findMany()).toMatchObject([
			{
				action: "UPDATE",
				changes: {
					startDate: {
						new: "2026-12-23T00:00:00.000Z",
						old: "2026-12-24T00:00:00.000Z",
					},
				},
				entityId: "h1",
				userId: user?.id,
			},
		]);
	});

	it("reports an importer failure on the job as a generic error", async () => {
		const { api, db } = await setup();
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		fake.failure = new Error("upstream exploded");
		const job = await importAll(api, []);
		expect(job).toMatchObject({
			message: m.common_something_went_wrong(),
			status: "error",
		});
		expect(error).toHaveBeenCalledWith(
			"[ImportsApi.start]",
			expect.any(String),
			fake.failure,
		);
		expect(await db.appointment.count()).toBe(0);
	});

	it("rejects an unknown importer with NotFoundError", async () => {
		const { api } = await setup();
		await expect(api.start("nope", {})).rejects.toBeInstanceOf(NotFoundError);
	});

	it("rejects a disabled importer with NotFoundError", async () => {
		const { api, db } = await setup();
		await db.importerSetting.create({
			data: { enabled: false, importerId: "fake" },
		});
		await expect(api.start("fake", {})).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ImportsApi.progress", () => {
	it("throws NotFoundError for an unknown job", async () => {
		const { api } = await setup();
		await expect(api.progress("nope")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("ImportsApi settings", () => {
	it("lists importers as enabled by default", async () => {
		const { api } = await setup();
		expect(await api.settings()).toMatchObject([{ enabled: true, id: "fake" }]);
	});

	it("lets an ADMIN disable and re-enable an importer", async () => {
		const { api, db } = await setup("ADMIN");
		await api.setEnabled("fake", false);
		expect(await api.settings()).toMatchObject([
			{ enabled: false, id: "fake" },
		]);
		await api.setEnabled("fake", true);
		expect(await db.importerSetting.findMany()).toEqual([
			{ enabled: true, importerId: "fake" },
		]);
	});

	it("rejects toggling an unknown importer", async () => {
		const { api, db } = await setup("ADMIN");
		await expect(api.setEnabled("nope", false)).rejects.toBeInstanceOf(
			NotFoundError,
		);
		expect(await db.importerSetting.count()).toBe(0);
	});
});

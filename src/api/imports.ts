import { createServerFn } from "@tanstack/react-start";
import { getImporter, listImporters } from "@/importers/registry.server";
import type { EmitResult, ImportEntity } from "@/importers/types";
import { prismaClient } from "@/lib/db";
import type { Prisma } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { requireAdmin, requireEditor } from "@/lib/session";
import { m } from "@/paraglide/messages";

type ImportJob = {
	status: "running" | "done" | "error";
	imported: number;
	updated: number;
	skipped: number;
	message?: string;
};

// In-memory only: import jobs are short-lived and progress doesn't need to
// survive a server restart, so a DB table would be overkill.
const importJobs = new Map<string, ImportJob>();
const IMPORT_JOB_TTL_MS = 5 * 60 * 1000;

async function isImporterEnabled(importerId: string) {
	const setting = await prismaClient.importerSetting.findUnique({
		where: { importerId },
	});
	return setting?.enabled ?? true;
}

async function persistEntity(
	entity: ImportEntity,
	userId: string,
): Promise<EmitResult> {
	if (entity.type !== "event") {
		throw new Error(`Import entity type "${entity.type}" is not supported`);
	}

	const existingAppointment = await prismaClient.appointment.findUnique({
		where: { id: entity.externalId },
	});

	if (!existingAppointment) {
		await prismaClient.$transaction(async (tx) => {
			// TEAM_MATCH appointments derive their season from ownTeam; anything
			// else (e.g. imported holidays) doesn't need one at all.
			const seasonId = entity.teamMatch
				? (
						await tx.team.findUniqueOrThrow({
							where: { id: entity.teamMatch.ownTeamId },
						})
					).seasonId
				: undefined;
			const appointment = await tx.appointment.create({
				data: {
					awayTeam: entity.teamMatch?.awayTeam,
					endDate: entity.endsAt ? new Date(entity.endsAt) : null,
					homeTeam: entity.teamMatch?.homeTeam,
					id: entity.externalId,
					ownTeamId: entity.teamMatch?.ownTeamId,
					seasonId,
					shortTitle: entity.title,
					startDate: new Date(entity.startsAt),
					title: entity.title,
					type: entity.appointmentType,
				},
			});
			await tx.transaction.create({
				data: {
					appointmentId: appointment.id,
					type: TransactionType.CREATE,
					userId,
				},
			});
		});
		return { status: "imported" };
	}

	const startDate = new Date(entity.startsAt);
	if (existingAppointment.startDate.valueOf() === startDate.valueOf()) {
		return { status: "skipped" };
	}

	await prismaClient.$transaction(async (tx) => {
		const appointment = await tx.appointment.update({
			data: { startDate },
			where: { id: entity.externalId },
		});
		await tx.transaction.create({
			data: {
				appointmentId: appointment.id,
				changes: {
					startDate: {
						new: appointment.startDate,
						old: existingAppointment.startDate,
					},
				} as Prisma.InputJsonValue,
				type: TransactionType.UPDATE,
				userId,
			},
		});
	});

	return { status: "updated" };
}

export const runImport = createServerFn()
	.validator((d: { importerId: string; config: Record<string, unknown> }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		const importer = getImporter(data.importerId);
		if (!importer || !(await isImporterEnabled(importer.id))) {
			throw new Error(m.imports_importer_not_found());
		}

		const jobId = crypto.randomUUID();
		importJobs.set(jobId, {
			imported: 0,
			skipped: 0,
			status: "running",
			updated: 0,
		});

		// Not awaited: the client polls getImportProgress for updates instead of
		// blocking on a single request for the whole (potentially long) import.
		void (async () => {
			const job = importJobs.get(jobId);
			if (!job) return;

			try {
				const result = await importer.run({
					config: data.config,
					emit: async (entity) => {
						const entityResult = await persistEntity(entity, session.id);
						if (entityResult.status === "imported") {
							job.imported++;
						} else if (entityResult.status === "updated") {
							job.updated++;
						} else {
							job.skipped++;
						}
						return entityResult;
					},
					log: (level, message) =>
						console[level](`[${importer.id}] ${message}`),
					secrets: {},
				});
				job.status = "done";
				job.message = m.imports_n_created_n_updated_n_skipped({
					param1: result.imported.toString(),
					param2: job.updated.toString(),
					param3: result.skipped.toString(),
				});
			} catch (e) {
				console.error(e);
				job.status = "error";
				job.message = (e as Error).message;
			} finally {
				setTimeout(() => importJobs.delete(jobId), IMPORT_JOB_TTL_MS);
			}
		})();

		return { data: { jobId }, message: m.imports_import_started() };
	});

export const getImportProgress = createServerFn()
	.validator((d: { jobId: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		const job = importJobs.get(data.jobId);
		if (!job) {
			throw new Error(m.imports_import_not_found());
		}

		return { data: job, message: "" };
	});

export const getImporterSettings = createServerFn().handler(async () => {
	const session = await requireEditor();
	if (!session) {
		throw new Error(m.common_unauthorized());
	}

	const settings = await Promise.all(
		listImporters().map(async (importer) => ({
			...importer,
			enabled: await isImporterEnabled(importer.id),
		})),
	);

	return { data: settings, message: m.imports_importers_found() };
});

export const setImporterEnabled = createServerFn()
	.validator((d: { importerId: string; enabled: boolean }) => d)
	.handler(async ({ data }) => {
		const session = await requireAdmin();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			if (!getImporter(data.importerId)) {
				throw new Error(m.imports_importer_not_found());
			}

			await prismaClient.importerSetting.upsert({
				create: { enabled: data.enabled, importerId: data.importerId },
				update: { enabled: data.enabled },
				where: { importerId: data.importerId },
			});

			return { message: m.common_settings_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

import { getImporter, listImporters } from "@/importers/registry.server";
import type { EmitResult, ImportEntity } from "@/importers/types";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	NotFoundError,
	type Policies,
	toUserFacingError,
} from "./kernel.server";

export type ImportJob = {
	status: "running" | "done" | "error";
	imported: number;
	updated: number;
	skipped: number;
	message?: string;
};

// In-memory only: import jobs are short-lived and progress doesn't need to
// survive a server restart, so a DB table would be overkill. Module-level so a
// job outlives the request (and class instance) that started it.
const importJobs = new Map<string, ImportJob>();
const IMPORT_JOB_TTL_MS = 5 * 60 * 1000;

export class ImportsApi extends ApiBase {
	static readonly policy = {
		progress: "EDITOR",
		setEnabled: "ADMIN",
		settings: "EDITOR",
		start: "EDITOR",
	} as const satisfies Policies<ImportsApi>;

	// Starts the import in the background and returns its job id at once: the
	// client polls `progress` instead of blocking one request on the whole
	// (potentially long) import.
	async start(importerId: string, config: Record<string, unknown>) {
		const importer = getImporter(importerId);
		if (!importer || !(await this.isEnabled(importer.id))) {
			throw new NotFoundError(m.imports_importer_not_found());
		}

		const jobId = crypto.randomUUID();
		const job: ImportJob = {
			imported: 0,
			skipped: 0,
			status: "running",
			updated: 0,
		};
		importJobs.set(jobId, job);
		const actorId = this.requiredActorId;

		// Not awaited. The job keeps using this instance after the request
		// ends, which is safe because ctx.db is the process-wide Prisma client,
		// not a request-scoped one.
		void (async () => {
			try {
				const result = await importer.run({
					config,
					emit: async (entity) => {
						const { status } = await this.persist(entity);
						job[status]++;
						return { status };
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
				// The job outlives the request, so ApiBase can't catch this.
				job.status = "error";
				job.message = toUserFacingError(e, "ImportsApi.start", actorId).message;
			} finally {
				setTimeout(() => importJobs.delete(jobId), IMPORT_JOB_TTL_MS).unref();
			}
		})();

		return { jobId };
	}

	async progress(jobId: string) {
		const job = importJobs.get(jobId);
		if (!job) throw new NotFoundError(m.imports_import_not_found());
		return { ...job };
	}

	async settings() {
		return Promise.all(
			listImporters().map(async (importer) => ({
				...importer,
				enabled: await this.isEnabled(importer.id),
			})),
		);
	}

	async setEnabled(importerId: string, enabled: boolean) {
		if (!getImporter(importerId)) {
			throw new NotFoundError(m.imports_importer_not_found());
		}
		await this.ctx.db.importerSetting.upsert({
			create: { enabled, importerId },
			update: { enabled },
			where: { importerId },
		});
	}

	private async isEnabled(importerId: string) {
		const setting = await this.ctx.db.importerSetting.findUnique({
			where: { importerId },
		});
		return setting?.enabled ?? true;
	}

	// Imported appointments keep the source's external id as their own id, so
	// a re-import finds them again; only a moved start date counts as a change.
	private async persist(entity: ImportEntity): Promise<EmitResult> {
		if (entity.type !== "event") {
			throw new Error(`Import entity type "${entity.type}" is not supported`);
		}

		const existing = await this.ctx.db.appointment.findUnique({
			where: { id: entity.externalId },
		});

		if (!existing) {
			await this.tx(async (tx) => {
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
						startDate: new Date(entity.startsAt),
						title: entity.title,
						type: entity.appointmentType,
					},
				});
				await this.journal(tx, "Appointment").created(appointment.id);
			});
			return { status: "imported" };
		}

		const startDate = new Date(entity.startsAt);
		if (existing.startDate.valueOf() === startDate.valueOf()) {
			return { status: "skipped" };
		}

		await this.tx(async (tx) => {
			const appointment = await tx.appointment.update({
				data: { startDate },
				where: { id: entity.externalId },
			});
			await this.journal(tx, "Appointment").updated(
				appointment.id,
				existing,
				appointment,
				["startDate"],
			);
		});
		return { status: "updated" };
	}
}

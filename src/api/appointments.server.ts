import type { AuditChanges } from "@/lib/auditLog";
import { labelsInclude } from "@/lib/labels";
import { redactPlayerFlags } from "@/lib/players";
import type { Appointment, Prisma } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { userViewSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import {
	type AuditEntry,
	auditEntriesFor,
	type SoftDeleteAction,
} from "./auditLog.domain.server";
import {
	ApiBase,
	ApiError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

const appointmentDetailInclude = {
	labels: labelsInclude,
	nextAppointment: true,
	ownTeam: true,
	placements: {
		include: { player: true },
	},
	responses: {
		include: { user: { select: userViewSelect } },
	},
	season: true,
} satisfies Prisma.AppointmentInclude;

export type AppointmentDetail = Prisma.AppointmentGetPayload<{
	include: typeof appointmentDetailInclude;
}> & { auditLog: AuditEntry[] };

export type AppointmentListFilter = {
	title?: string;
	location?: string;
	minDate?: Date;
	withDeleted?: boolean;
	seasonId?: string;
	orderBy?:
		| Prisma.AppointmentOrderByWithRelationInput
		| Prisma.AppointmentOrderByWithRelationInput[];
};

export type AppointmentsPageFilter = {
	query?: string;
	typeGroup?: "TOURNAMENT" | "TEAM_MATCH";
	responses?: (ResponseType | "NONE")[];
	teamIds?: string[];
	seasonId?: string;
	sortDir?: "asc" | "desc";
	skip: number;
	take: number;
};

export type CreateAppointmentInput =
	| {
			title: string;
			type: "HOLIDAY";
			startDate: Date;
			endDate: Date | null;
	  }
	| {
			title: string;
			type: "TOURNAMENT";
			startDate: Date;
			endDate: Date | null;
			location: string | null;
			status: AppointmentStatus;
			seasonId: string;
			labelIds: string[];
	  };

export type AppointmentUpdate = Partial<Appointment> & { labelIds?: string[] };

// The fields `update` writes (and journals); anything else in an update is
// ignored. Labels are synced separately.
const EDITABLE_FIELDS = [
	"endDate",
	"link",
	"location",
	"nextAppointmentId",
	"seasonId",
	"startDate",
	"status",
	"title",
] as const satisfies readonly (keyof Appointment)[];

export type CalendarRange = { start: Date; end: Date; seasonId?: string };

const startOfToday = () => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
};

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

// There is no global soft-delete filter (see CLAUDE.md, Prisma), so every
// query here scopes to active rows itself.
const activeNonHoliday = {
	deletedAt: null,
	NOT: { type: AppointmentType.HOLIDAY },
} as const satisfies Prisma.AppointmentWhereInput;

// Free-text search over title or location; no query matches everything.
const titleOrLocation = (query: string | undefined) => ({
	OR: [
		{ title: { contains: query ?? "" } },
		{ location: { contains: query ?? "" } },
	],
});

// The filters of the bulk management list (/appts/bulk) and the trash
// (/appts/trash). A "matching" selector uses the same shape, so "every row
// matching the active filters" means the same rows in the list and the
// action.
export type BulkAppointmentsFilter = {
	query?: string;
	seasonId?: string;
	types?: AppointmentType[];
};

export type BulkAppointmentsPageFilter = BulkAppointmentsFilter & {
	skip: number;
	take: number;
};

// What a bulk action acts on: explicit ids, or whatever matches the filter
// when the action runs (not when "select all matching" was clicked), minus
// the rows the user unchecked.
export type AppointmentSelector =
	| { ids: string[] }
	| { matching: BulkAppointmentsFilter; excludeIds: string[] };

type DeletedScope = Prisma.AppointmentWhereInput["deletedAt"];
const ACTIVE: DeletedScope = null;
const TRASHED: DeletedScope = { not: null };

// The rows a soft-delete action may act on, and the `deletedAt` it sets.
const softDelete = {
	DELETE: { from: ACTIVE, to: () => new Date() },
	RESTORE: { from: TRASHED, to: () => null },
} as const satisfies Record<
	SoftDeleteAction,
	{ from: DeletedScope; to: () => Date | null }
>;

const bulkFilterWhere = (
	filter: BulkAppointmentsFilter,
	deletedAt: DeletedScope,
): Prisma.AppointmentWhereInput => ({
	deletedAt,
	...titleOrLocation(filter.query),
	seasonId: filter.seasonId,
	type:
		filter.types && filter.types.length > 0 ? { in: filter.types } : undefined,
});

// Every id in a selector, and every resolved id, becomes one bound SQL
// parameter; SQLite allows ~999, so larger selections get a friendly error
// instead of a raw DB one.
const MAX_BULK_SELECTION_IDS = 500;

// Each chunk of a bulk delete/restore commits on its own, so a large
// selection never holds one long transaction.
const SOFT_DELETE_CHUNK_SIZE = 100;

const chunk = <T>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
};

// Same month/day/time one calendar year later; Feb 29 lands on Mar 1 in a
// non-leap target year, matching plain `Date` rollover.
const oneYearLater = (date: Date) => {
	const shifted = new Date(date);
	shifted.setFullYear(shifted.getFullYear() + 1);
	return shifted;
};

export class AppointmentsApi extends ApiBase {
	static readonly policy = {
		acceptedBy: "AUTHENTICATED",
		bulkDelete: "EDITOR",
		bulkPage: "EDITOR",
		bulkRestore: "EDITOR",
		calendar: "AUTHENTICATED",
		copyToSeason: "EDITOR",
		create: "EDITOR",
		delete: "EDITOR",
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		next: "AUTHENTICATED",
		openFor: "AUTHENTICATED",
		page: "AUTHENTICATED",
		publish: "EDITOR",
		respond: "AUTHENTICATED",
		restore: "EDITOR",
		search: "AUTHENTICATED",
		trashPage: "EDITOR",
		unpublish: "EDITOR",
		update: "EDITOR",
	} as const satisfies Policies<AppointmentsApi>;

	// Player flags (Club Member / Playing Eligibility) are editor-only, see
	// `redactPlayerFlags`.
	async get(id: string): Promise<AppointmentDetail> {
		const appointment = await this.ctx.db.appointment.findUnique({
			include: appointmentDetailInclude,
			where: { id },
		});
		if (!appointment) {
			throw new NotFoundError(m.appointments_appointment_not_found());
		}
		const canSeeFlags = this.isAtLeast("EDITOR");
		return {
			...appointment,
			auditLog: await auditEntriesFor(this.ctx.db, "Appointment", id),
			placements: appointment.placements.map((pl) => ({
				...pl,
				player: redactPlayerFlags(pl.player, canSeeFlags),
			})),
		};
	}

	// The global search box: newest 10 non-holiday matches by title or
	// location.
	async search(query: string | undefined) {
		return this.ctx.db.appointment.findMany({
			include: {
				labels: labelsInclude,
				placements: { distinct: "playerId" },
			},
			orderBy: { startDate: "desc" },
			take: 10,
			where: { ...activeNonHoliday, ...titleOrLocation(query) },
		});
	}

	// Tournaments only (the detail page's "next appointment in series" picker).
	async list(filter: AppointmentListFilter) {
		return this.ctx.db.appointment.findMany({
			include: { ownTeam: true, responses: true },
			orderBy: filter.orderBy,
			where: {
				deletedAt: filter.withDeleted ? undefined : null,
				location: { contains: filter.location },
				seasonId: filter.seasonId,
				startDate: { gt: filter.minDate },
				title: { contains: filter.title ?? "" },
				type: AppointmentType.TOURNAMENT,
			},
		});
	}

	// The RSVP-centric upcoming list: today or later, non-holiday, filterable
	// by the actor's own response. `grandTotal` ignores every filter but the
	// season.
	async page(filter: AppointmentsPageFilter) {
		const userId = this.requiredActorId;
		const responseTypes = (filter.responses ?? []).filter(
			(r): r is ResponseType => r !== "NONE",
		);
		const wantsNoResponse = (filter.responses ?? []).includes("NONE");
		// "No response" (`none`) and specific response types (`some`) can't be
		// one relation filter, so that combination becomes its own `OR`, kept
		// apart from the query-text `OR` via `AND`.
		const mixedResponseFilter = wantsNoResponse && responseTypes.length > 0;
		const noResponse = { responses: { none: { userId } } };
		const someResponse = {
			responses: { some: { responseType: { in: responseTypes }, userId } },
		};
		const todayStart = startOfToday();

		const where: Prisma.AppointmentWhereInput = {
			...activeNonHoliday,
			...(mixedResponseFilter
				? {}
				: wantsNoResponse
					? noResponse
					: responseTypes.length > 0
						? someResponse
						: {}),
			AND: [
				titleOrLocation(filter.query),
				mixedResponseFilter ? { OR: [noResponse, someResponse] } : {},
			],
			ownTeamId:
				filter.teamIds && filter.teamIds.length > 0
					? { in: filter.teamIds }
					: undefined,
			seasonId: filter.seasonId,
			startDate: { gte: todayStart },
			type: filter.typeGroup,
		};

		const [appointments, matchedTotal, grandTotal] = await Promise.all([
			this.ctx.db.appointment.findMany({
				include: { labels: labelsInclude, ownTeam: true, responses: true },
				orderBy: { startDate: filter.sortDir ?? "asc" },
				skip: filter.skip,
				take: filter.take,
				where,
			}),
			this.ctx.db.appointment.count({ where }),
			this.ctx.db.appointment.count({
				where: {
					...activeNonHoliday,
					seasonId: filter.seasonId,
					startDate: { gte: todayStart },
				},
			}),
		]);
		return { appointments, grandTotal, matchedTotal };
	}

	// The dashboard: today through four weeks ahead, non-holiday.
	async next() {
		const today = startOfToday();
		const fourWeeks = new Date(today.getTime() + FOUR_WEEKS_MS);
		return this.ctx.db.appointment.findMany({
			orderBy: { startDate: "asc" },
			where: {
				...activeNonHoliday,
				startDate: { gte: today, lt: fourWeeks },
			},
		});
	}

	// Upcoming tournaments `userId` accepted.
	async acceptedBy(userId: string) {
		return this.ctx.db.appointment.findMany({
			include: { responses: true },
			orderBy: { startDate: "asc" },
			where: {
				deletedAt: null,
				responses: { some: { responseType: "ACCEPT", userId } },
				startDate: { gte: new Date() },
				type: AppointmentType.TOURNAMENT,
			},
		});
	}

	// Tournaments from today on that `userId` hasn't committed to: no response,
	// or "Maybe" (the UI treats a missing response as Maybe too).
	async openFor(userId: string) {
		return this.ctx.db.appointment.findMany({
			include: { responses: true },
			orderBy: { startDate: "asc" },
			where: {
				deletedAt: null,
				OR: [
					{ responses: { none: { userId } } },
					{ responses: { some: { responseType: "MAYBE", userId } } },
				],
				startDate: { gte: startOfToday() },
				type: AppointmentType.TOURNAMENT,
			},
		});
	}

	// Every active appointment overlapping [start, end), as calendar entries
	// (a single-day one ends where it starts).
	async calendar({ start, end, seasonId }: CalendarRange) {
		const from = new Date(start);
		const appointments = await this.ctx.db.appointment.findMany({
			include: { labels: labelsInclude },
			where: {
				deletedAt: null,
				OR: [
					{ endDate: { gte: from } },
					{ endDate: null, startDate: { gte: from } },
				],
				seasonId,
				startDate: { lt: new Date(end) },
			},
		});
		return appointments.map((a) => ({
			end: a.endDate ?? a.startDate,
			id: a.id,
			labels: a.labels.map((l) => l.label),
			location: a.location,
			start: a.startDate,
			title: a.title,
			type: a.type,
		}));
	}

	// The actor's RSVP; a second call changes it.
	async respond(appointmentId: string, responseType: ResponseType) {
		const userId = this.requiredActorId;
		return this.tx(async (tx) => {
			const appointment = await tx.appointment.findFirst({
				select: { id: true },
				where: { deletedAt: null, id: appointmentId },
			});
			if (!appointment) {
				throw new NotFoundError(m.appointments_appointment_not_found());
			}
			return tx.response.upsert({
				create: { appointmentId, responseType, userId },
				update: { responseType },
				where: { userId_appointmentId: { appointmentId, userId } },
			});
		});
	}

	// A published tournament notifies on creation; drafts and holidays don't.
	async create(input: CreateAppointmentInput) {
		const appointment = await this.tx(async (tx) => {
			const appointment = await tx.appointment.create({
				data:
					input.type === AppointmentType.HOLIDAY
						? {
								endDate: input.endDate,
								startDate: input.startDate,
								title: input.title,
								type: input.type,
							}
						: {
								endDate: input.endDate,
								labels: {
									create: input.labelIds.map((labelId) => ({ labelId })),
								},
								location: input.location,
								seasonId: input.seasonId,
								startDate: input.startDate,
								status: input.status,
								title: input.title,
								type: input.type,
							},
			});
			await this.journal(tx, "Appointment").created(appointment.id);
			return appointment;
		});
		if (
			appointment.type === AppointmentType.TOURNAMENT &&
			appointment.status === AppointmentStatus.PUBLISHED
		) {
			this.ctx.notifier.published(appointment, this.requiredActorId);
		}
		return appointment;
	}

	// Click-to-edit saves one field or group at a time: only the editable
	// fields present in `updates` (and actually changed) are journalled. A
	// tournament's subscribers get a (debounced) update push.
	async update(id: string, updates: AppointmentUpdate) {
		const { labelIds } = updates;
		const fields = EDITABLE_FIELDS.filter((field) => field in updates);
		const appointment = await this.tx(async (tx) => {
			const before = await this.requireAppointment(tx, id);
			const appointment = await tx.appointment.update({
				// `undefined` leaves a field untouched.
				data: {
					endDate: updates.endDate,
					link: updates.link,
					location: updates.location,
					nextAppointmentId: updates.nextAppointmentId,
					seasonId: updates.seasonId,
					startDate: updates.startDate,
					status: updates.status,
					title: updates.title,
				},
				where: { id },
			});
			const labelChanges =
				labelIds === undefined
					? {}
					: await this.syncLabels(
							tx,
							id,
							before.labels.map((l) => l.labelId),
							labelIds,
						);
			await this.journal(tx, "Appointment").updated(
				id,
				before,
				appointment,
				fields,
				labelChanges,
			);
			return appointment;
		});
		if (appointment.type === AppointmentType.TOURNAMENT) {
			this.ctx.notifier.updated(appointment, this.requiredActorId);
		}
		return appointment;
	}

	// Notifies only when a tournament actually went from unpublished to
	// published, so a repeated publish stays silent.
	async publish(id: string) {
		const { appointment, changed } = await this.setStatus(
			id,
			AppointmentStatus.PUBLISHED,
		);
		if (changed && appointment.type === AppointmentType.TOURNAMENT) {
			this.ctx.notifier.published(appointment, this.requiredActorId);
		}
		return appointment;
	}

	async unpublish(id: string) {
		const { appointment } = await this.setStatus(id, AppointmentStatus.DRAFT);
		return appointment;
	}

	// The bulk management list: any active appointment, holidays and past ones
	// included (unlike the RSVP-centric `page`).
	async bulkPage(filter: BulkAppointmentsPageFilter) {
		return this.filteredPage(filter, ACTIVE);
	}

	async trashPage(filter: BulkAppointmentsPageFilter) {
		return this.filteredPage(filter, TRASHED);
	}

	// Deleting an already deleted appointment (a stale tab) is a NotFound, not
	// a second journal entry. Cancels a pending (debounced) update push.
	async delete(id: string) {
		return this.softDeleteOne(id, "DELETE");
	}

	async restore(id: string) {
		return this.softDeleteOne(id, "RESTORE");
	}

	// Rows no longer active by the time the action runs are skipped.
	async bulkDelete(selector: AppointmentSelector) {
		return this.setDeleted(
			await this.resolveSelector(selector, ACTIVE),
			"DELETE",
		);
	}

	async bulkRestore(selector: AppointmentSelector) {
		return this.setDeleted(
			await this.resolveSelector(selector, TRASHED),
			"RESTORE",
		);
	}

	// Copies the selected active appointments into `targetSeasonId` one year
	// later, as drafts. Holidays have no season and are skipped rather than
	// failing a mixed selection. Labels and responses are not copied.
	async copyToSeason(selector: AppointmentSelector, targetSeasonId: string) {
		const season = await this.ctx.db.season.findUnique({
			select: { id: true },
			where: { id: targetSeasonId },
		});
		if (!season) {
			throw new NotFoundError(m.appointments_season_not_found());
		}
		const ids = await this.resolveSelector(selector, ACTIVE);
		return this.tx(async (tx) => {
			const sources = await tx.appointment.findMany({
				where: { deletedAt: null, id: { in: ids } },
			});
			const journal = this.journal(tx, "Appointment");
			let copied = 0;
			let skipped = 0;
			for (const source of sources) {
				if (source.seasonId === null) {
					skipped++;
					continue;
				}
				const copy = await tx.appointment.create({
					data: {
						awayTeam: source.awayTeam,
						endDate: source.endDate ? oneYearLater(source.endDate) : null,
						homeTeam: source.homeTeam,
						link: source.link,
						location: source.location,
						ownTeamId: source.ownTeamId,
						seasonId: targetSeasonId,
						startDate: oneYearLater(source.startDate),
						status: AppointmentStatus.DRAFT,
						title: source.title,
						type: source.type,
					},
				});
				await journal.created(copy.id);
				copied++;
			}
			return { copied, skipped };
		});
	}

	private async filteredPage(
		filter: BulkAppointmentsPageFilter,
		deletedAt: DeletedScope,
	) {
		const where = bulkFilterWhere(filter, deletedAt);
		const [appointments, matchedTotal, grandTotal] = await Promise.all([
			this.ctx.db.appointment.findMany({
				include: { labels: labelsInclude, season: true },
				// `id` breaks `startDate` ties so skip/take paging can't repeat or
				// skip a row.
				orderBy: [{ startDate: "desc" }, { id: "asc" }],
				skip: filter.skip,
				take: filter.take,
				where,
			}),
			this.ctx.db.appointment.count({ where }),
			this.ctx.db.appointment.count({ where: { deletedAt } }),
		]);
		return { appointments, grandTotal, matchedTotal };
	}

	private async softDeleteOne(id: string, action: SoftDeleteAction) {
		const [appointment] = await this.setDeleted([id], action);
		if (!appointment) {
			throw new NotFoundError(m.appointments_appointment_not_found());
		}
		return appointment;
	}

	// The selector's ids in `deletedAt` scope right now. A `matching`
	// selector's exclude list says nothing about how many rows match, so the
	// resolved count is checked too.
	private async resolveSelector(
		selector: AppointmentSelector,
		deletedAt: DeletedScope,
	) {
		const tooLarge = () =>
			new ApiError(
				m.appointments_bulk_selection_too_large({
					max: MAX_BULK_SELECTION_IDS,
				}),
			);
		const listed =
			"ids" in selector ? selector.ids.length : selector.excludeIds.length;
		if (listed > MAX_BULK_SELECTION_IDS) throw tooLarge();

		const rows = await this.ctx.db.appointment.findMany({
			select: { id: true },
			where:
				"ids" in selector
					? { deletedAt, id: { in: selector.ids } }
					: {
							...bulkFilterWhere(selector.matching, deletedAt),
							id: { notIn: selector.excludeIds },
						},
		});
		if (rows.length > MAX_BULK_SELECTION_IDS) throw tooLarge();
		return rows.map((row) => row.id);
	}

	// Soft-deletes or restores `ids` in chunks, one transaction and one
	// journal entry per row each; rows whose state changed since they were
	// resolved are skipped. A failure partway leaves earlier chunks committed.
	// A deleted row's pending update push is cancelled once its chunk has
	// committed, so a rolled-back chunk can't drop a real push.
	private async setDeleted(ids: string[], action: SoftDeleteAction) {
		const { from, to } = softDelete[action];
		const updated: Appointment[] = [];
		for (const batch of chunk(ids, SOFT_DELETE_CHUNK_SIZE)) {
			const rows = await this.tx(async (tx) => {
				const where = { deletedAt: from, id: { in: batch } };
				const targets = (
					await tx.appointment.findMany({ select: { id: true }, where })
				).map((row) => row.id);
				if (targets.length === 0) return [];
				await tx.appointment.updateMany({
					data: { deletedAt: to() },
					where: { id: { in: targets } },
				});
				const journal = this.journal(tx, "Appointment");
				await (action === "DELETE"
					? journal.softDeleted(targets)
					: journal.restored(targets));
				return tx.appointment.findMany({ where: { id: { in: targets } } });
			});
			if (action === "DELETE") {
				for (const row of rows) this.ctx.notifier.cancelUpdated(row.id);
			}
			updated.push(...rows);
		}
		return updated;
	}

	private setStatus(id: string, status: AppointmentStatus) {
		return this.tx(async (tx) => {
			const before = await this.requireAppointment(tx, id);
			const appointment = await tx.appointment.update({
				data: { status },
				where: { id },
			});
			const changes = await this.journal(tx, "Appointment").updated(
				id,
				before,
				appointment,
				["status"],
			);
			return { appointment, changed: "status" in changes };
		});
	}

	// With its label links, for the label diff. Soft-deleted appointments are
	// found too: the detail page still edits and publishes them.
	private async requireAppointment(tx: Tx, id: string) {
		const appointment = await tx.appointment.findUnique({
			include: { labels: true },
			where: { id },
		});
		if (!appointment) {
			throw new NotFoundError(m.appointments_appointment_not_found());
		}
		return appointment;
	}

	// Replaces the appointment's labels when the set differs and returns the
	// journal change with label ids resolved to names (a since-deleted label
	// falls back to its raw id); unchanged sets write and return nothing.
	private async syncLabels(
		tx: Tx,
		appointmentId: string,
		beforeIds: string[],
		afterIds: string[],
	): Promise<AuditChanges> {
		const sortedBefore = [...beforeIds].sort();
		const sortedAfter = [...afterIds].sort();
		const unchanged =
			sortedBefore.length === sortedAfter.length &&
			sortedBefore.every((labelId, i) => labelId === sortedAfter[i]);
		if (unchanged) return {};

		await tx.appointmentLabel.deleteMany({ where: { appointmentId } });
		if (afterIds.length > 0) {
			await tx.appointmentLabel.createMany({
				data: afterIds.map((labelId) => ({ appointmentId, labelId })),
			});
		}
		const labels = await tx.label.findMany({
			where: { id: { in: [...new Set([...beforeIds, ...afterIds])] } },
		});
		const nameById = new Map(labels.map((l) => [l.id, l.name]));
		const names = (ids: string[]) => ids.map((i) => nameById.get(i) ?? i);
		return { labels: { new: names(afterIds), old: names(beforeIds) } };
	}
}

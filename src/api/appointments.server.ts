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
import { type AuditEntry, auditEntriesFor } from "./auditLog.domain.server";
import {
	ApiBase,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

// Migrated in slices (issue #119 onwards): this class holds the reads, RSVP
// responses, create, update and publish so far; delete/restore and the bulk
// and trash actions still live in the legacy handlers in `appointments.ts`
// until their slices land.

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

export class AppointmentsApi extends ApiBase {
	static readonly policy = {
		acceptedBy: "AUTHENTICATED",
		calendar: "AUTHENTICATED",
		create: "EDITOR",
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		next: "AUTHENTICATED",
		openFor: "AUTHENTICATED",
		page: "AUTHENTICATED",
		publish: "EDITOR",
		respond: "AUTHENTICATED",
		search: "AUTHENTICATED",
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

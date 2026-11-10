import { labelsInclude } from "@/lib/labels";
import { redactPlayerFlags } from "@/lib/players";
import type { Prisma } from "@/lib/prisma/client";
import { AppointmentType, type ResponseType } from "@/lib/prisma/enums";
import { userViewSelect } from "@/lib/users";
import { m } from "@/paraglide/messages";
import { type AuditEntry, auditEntriesFor } from "./auditLog.domain.server";
import { ApiBase, NotFoundError, type Policies } from "./kernel.server";

// Migrated in slices (issue #119 onwards): this class holds the reads and RSVP
// responses so far; the mutations still live in the legacy handlers in
// `appointments.ts` until their slices land.

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
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		next: "AUTHENTICATED",
		openFor: "AUTHENTICATED",
		page: "AUTHENTICATED",
		respond: "AUTHENTICATED",
		search: "AUTHENTICATED",
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
}

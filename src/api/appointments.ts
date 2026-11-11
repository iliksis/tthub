import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { labelsInclude } from "@/lib/labels";
import type {
	Appointment,
	AppointmentLabel,
	Label,
	Prisma,
	Response,
	Season,
	Team,
} from "@/lib/prisma/client";
import {
	AppointmentStatus,
	type AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { requireEditor } from "@/lib/session";
import { m } from "@/paraglide/messages";
import {
	type AppointmentListFilter,
	AppointmentsApi,
	type AppointmentsPageFilter,
	type AppointmentUpdate,
	type CalendarRange,
	type CreateAppointmentInput,
} from "./appointments.server";
import { AuditJournal, type SoftDeleteAction } from "./auditLog.domain.server";
import { run } from "./kernel.server";
import { notifier } from "./notifier.server";

export type {
	AppointmentDetail,
	AppointmentListFilter,
	AppointmentsPageFilter,
	AppointmentUpdate,
	CalendarRange,
	CreateAppointmentInput,
} from "./appointments.server";

export const createAppointment = createServerFn()
	.validator((d: CreateAppointmentInput) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_created, (api) =>
			api.create(data),
		),
	);

export type AppointmentWithResponses = Appointment & {
	responses: Response[];
	ownTeam: Team | null;
	labels: (AppointmentLabel & { label: Label })[];
};

export const getAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_found, (api) =>
			api.get(data.id),
		),
	);

export const searchAppointments = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.search(data.query),
		),
	);

export const getAppointments = createServerFn()
	.validator((d: AppointmentListFilter) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.list(data),
		),
	);

export const getAppointmentsPage = createServerFn()
	.validator((d: AppointmentsPageFilter) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.page(data),
		),
	);

export type AppointmentWithSeason = Appointment & {
	season: Season | null;
	labels: (AppointmentLabel & { label: Label })[];
};

// Shared between getBulkAppointmentsPage (listing) and bulkDeleteAppointments'
// "matching" selector (bulk action), so "every row matching the active
// filters" means the exact same set of rows in both places. Shared with the
// /appts/trash listing/actions (see getTrashAppointmentsPage below) — the
// filter shape is identical, only the `deletedAt` scope differs, so both
// pages build their `where` through the same helper.
export type BulkAppointmentsFilter = {
	query?: string;
	seasonId?: string;
	types?: AppointmentType[];
};

function buildAppointmentsFilterWhere(
	filter: BulkAppointmentsFilter,
	deletedAt: Prisma.AppointmentWhereInput["deletedAt"],
): Prisma.AppointmentWhereInput {
	return {
		deletedAt,
		OR: [
			{ title: { contains: filter.query ?? "" } },
			{ location: { contains: filter.query ?? "" } },
		],
		seasonId: filter.seasonId,
		type:
			filter.types && filter.types.length > 0
				? { in: filter.types }
				: undefined,
	};
}

// Shared by getBulkAppointmentsPage and getTrashAppointmentsPage below — same
// filter shape and query, only the `deletedAt` scope differs.
async function getAppointmentsListPage(
	data: BulkAppointmentsFilter & { skip: number; take: number },
	deletedAt: Prisma.AppointmentWhereInput["deletedAt"],
) {
	const where = buildAppointmentsFilterWhere(data, deletedAt);

	const [appointments, matchedTotal, grandTotal] = await Promise.all([
		prismaClient.appointment.findMany({
			include: {
				labels: labelsInclude,
				season: true,
			},
			// `id` breaks ties between rows sharing a `startDate` so paging
			// through skip/take can't duplicate or silently skip a row.
			orderBy: [{ startDate: "desc" }, { id: "asc" }],
			skip: data.skip,
			take: data.take,
			where,
		}),
		prismaClient.appointment.count({ where }),
		prismaClient.appointment.count({ where: { deletedAt } }),
	]);

	return { appointments, grandTotal, matchedTotal };
}

// Distinct from getAppointmentsPage: the bulk-management list is for
// finding/deleting *any* appointment (including HOLIDAYs and past dates),
// not the RSVP-centric upcoming list, so it isn't scoped to today-or-later
// or restricted to non-HOLIDAY types.
export const getBulkAppointmentsPage = createServerFn()
	.validator((d: BulkAppointmentsFilter & { skip: number; take: number }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			return {
				data: await getAppointmentsListPage(data, null),
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateAppointment = createServerFn()
	.validator((d: { id: string; updates: AppointmentUpdate }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_updated, (api) =>
			api.update(data.id, data.updates),
		),
	);

export const deleteAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// Re-verify the appointment is still active (deletedAt: null) before
			// acting, same as the bulk path — without this, calling delete twice
			// on an already-deleted appointment (e.g. a stale tab) would silently
			// succeed again and write a second DELETE audit log entry.
			const ids = await resolveSelectorIds({ ids: [data.id] }, null);
			if (ids.length === 0) {
				throw new Error(m.appointments_appointment_not_found());
			}
			const [appointment] = await setAppointmentsDeletedState(
				ids,
				new Date(),
				"DELETE",
				session.id,
				(appointment) => notifier.cancelUpdated(appointment.id),
			);
			return {
				data: appointment,
				message: m.appointments_appointment_deleted(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// Accepts either an explicit id list, or a "matching" selector (the same
// filter shape the listing queries use) plus excludeIds — the latter is
// re-evaluated against the current data here (not a snapshot taken when
// "select all matching filters" was activated), so the action affects
// whatever currently matches the filter, minus anything the user unchecked.
// Shared by every bulk appointment action (delete, copy-to-season, restore,
// ...) across both /appts/bulk (deletedAt: null) and /appts/trash
// (deletedAt: { not: null }).
export type AppointmentSelector =
	| { ids: string[] }
	| { matching: BulkAppointmentsFilter; excludeIds: string[] };

// Both `ids` (explicit selection) and `excludeIds` (the "select all matching"
// exclude-list) end up as one bound SQL parameter per id in the `in`/`notIn`
// clause below — SQLite's default bound-parameter limit is ~999, and a very
// large selection would otherwise surface as a raw DB error instead of a
// friendly one.
const MAX_BULK_SELECTION_IDS = 500;

async function resolveSelectorIds(
	data: AppointmentSelector,
	deletedAt: Prisma.AppointmentWhereInput["deletedAt"],
) {
	// For an explicit `ids` selector this list feeds directly into the `in`
	// clause below, so check it up front too — but for a `matching` selector
	// this only measures the exclude-list, not how many rows actually match,
	// so it can't be the only check (see the resolved-count check below).
	const idListSize = "ids" in data ? data.ids.length : data.excludeIds.length;
	if (idListSize > MAX_BULK_SELECTION_IDS) {
		throw new Error(
			m.appointments_bulk_selection_too_large({ max: MAX_BULK_SELECTION_IDS }),
		);
	}

	// Re-verify `deletedAt` against current state even for an explicit `ids`
	// selector — a stale selection (e.g. another user already restored/deleted
	// one of these ids) must not act on rows that no longer match the expected
	// state, matching the `matching` selector's behavior below.
	const where: Prisma.AppointmentWhereInput =
		"ids" in data
			? { deletedAt, id: { in: data.ids } }
			: {
					...buildAppointmentsFilterWhere(data.matching, deletedAt),
					id: { notIn: data.excludeIds },
				};
	const appointments = await prismaClient.appointment.findMany({
		select: { id: true },
		where,
	});

	// The check above can't bound a "matching" selector's resolved count (an
	// empty/small `excludeIds` says nothing about how many rows match), so
	// check the actual resolved list too — this is what feeds the unchunked
	// `id: { in: ids } }` query in bulkCopyAppointmentsToSeason downstream.
	if (appointments.length > MAX_BULK_SELECTION_IDS) {
		throw new Error(
			m.appointments_bulk_selection_too_large({ max: MAX_BULK_SELECTION_IDS }),
		);
	}

	return appointments.map((appointment) => appointment.id);
}

// Batch size for setAppointmentsDeletedState below — each chunk runs in its
// own `$transaction` rather than one transaction across the whole (up to
// MAX_BULK_SELECTION_IDS) selection, so a large bulk delete/restore doesn't
// hold a single long-lived transaction/lock for its entire duration.
const DELETED_STATE_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

// Shared by bulkDeleteAppointments and bulkRestoreAppointments — both set
// `deletedAt` on a list of ids and log one audit log entry per id, differing
// only in the target `deletedAt` value and the audit action.
async function setAppointmentsDeletedState(
	ids: string[],
	deletedAt: Date | null,
	action: SoftDeleteAction,
	userId: string,
	onEachUpdated?: (appointment: Appointment) => void,
) {
	const updated: Appointment[] = [];
	for (const batch of chunk(ids, DELETED_STATE_CHUNK_SIZE)) {
		const batchUpdated = await prismaClient.$transaction(async (tx) => {
			await tx.appointment.updateMany({
				data: { deletedAt },
				where: { id: { in: batch } },
			});
			const batchResults = await tx.appointment.findMany({
				where: { id: { in: batch } },
			});
			const journal = new AuditJournal(tx, "Appointment", userId);
			const updatedIds = batchResults.map((appointment) => appointment.id);
			if (action === "DELETE") {
				await journal.softDeleted(updatedIds);
			} else {
				await journal.restored(updatedIds);
			}
			return batchResults;
		});
		// Only cancel each row's pending notification once its chunk has
		// actually committed — `onEachUpdated` is a non-transactional in-memory
		// side effect (clearing a debounce timer), so calling it from inside
		// the transaction would permanently drop a real notification for a row
		// whose chunk later rolls back.
		for (const appointment of batchUpdated) {
			onEachUpdated?.(appointment);
		}
		updated.push(...batchUpdated);
	}
	return updated;
}

export const bulkDeleteAppointments = createServerFn()
	.validator((d: AppointmentSelector) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const ids = await resolveSelectorIds(data, null);

			// Cancel each row's pending update-notification once its chunk
			// commits, not after the whole (potentially large) bulk action
			// resolves — a wide gap here is what lets a pending 5s
			// update-notification timer slip through for an appointment
			// that's already soft-deleted.
			const appointments = await setAppointmentsDeletedState(
				ids,
				new Date(),
				"DELETE",
				session.id,
				(appointment) => notifier.cancelUpdated(appointment.id),
			);
			return {
				data: appointments,
				message: m.appointments_appointment_deleted_count({
					count: appointments.length,
				}),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// Same month/day/time one calendar year later; a source date of Feb 29 lands
// on Mar 1 in a non-leap target year, matching plain `Date` rollover.
function oneYearLater(date: Date) {
	const shifted = new Date(date);
	shifted.setFullYear(shifted.getFullYear() + 1);
	return shifted;
}

export const bulkCopyAppointmentsToSeason = createServerFn()
	.validator((d: AppointmentSelector & { targetSeasonId: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const targetSeason = await prismaClient.season.findUnique({
				where: { id: data.targetSeasonId },
			});
			if (!targetSeason) {
				throw new Error(m.appointments_season_not_found());
			}

			const ids = await resolveSelectorIds(data, null);

			const { copied, skipped } = await prismaClient.$transaction(
				async (tx) => {
					const sources = await tx.appointment.findMany({
						where: { deletedAt: null, id: { in: ids } },
					});

					let copied = 0;
					let skipped = 0;
					// HOLIDAY appointments have no seasonId and are skipped rather than
					// erred on, per the ticket — a mixed selection shouldn't fail the
					// whole action just because some rows aren't season-scoped.
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
								seasonId: data.targetSeasonId,
								startDate: oneYearLater(source.startDate),
								status: AppointmentStatus.DRAFT,
								title: source.title,
								type: source.type,
							},
						});
						await new AuditJournal(tx, "Appointment", session.id).created(
							copy.id,
						);
						copied++;
					}

					return { copied, skipped };
				},
			);

			return {
				data: { copied, skipped },
				message: m.appointments_copied_n_skipped_no_season({
					copied: copied.toString(),
					skipped: skipped.toString(),
				}),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// The trash listing reuses BulkAppointmentsFilter/getAppointmentsListPage
// above — same filter shape and query, only the `deletedAt` scope differs.
export const getTrashAppointmentsPage = createServerFn()
	.validator((d: BulkAppointmentsFilter & { skip: number; take: number }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			return {
				data: await getAppointmentsListPage(data, { not: null }),
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const bulkRestoreAppointments = createServerFn()
	.validator((d: AppointmentSelector) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const ids = await resolveSelectorIds(data, { not: null });

			const appointments = await setAppointmentsDeletedState(
				ids,
				null,
				"RESTORE",
				session.id,
			);
			return {
				data: appointments,
				message: m.appointments_appointment_restored_count({
					count: appointments.length,
				}),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createResponse = createServerFn()
	.validator((d: { appointmentId: string; response: ResponseType }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_response_created, (api) =>
			api.respond(data.appointmentId, data.response),
		),
	);

export const getNextAppointments = createServerFn().handler(() =>
	run(AppointmentsApi, m.appointments_appointments_found, (api) => api.next()),
);

export const getUserAppointments = createServerFn()
	.validator((d: { userId: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.acceptedBy(data.userId),
		),
	);

export const getUserOpenAppointments = createServerFn()
	.validator((d: { userId: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.openFor(data.userId),
		),
	);

export const getCalendarAppointments = createServerFn()
	.validator((d: CalendarRange) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.calendar(data),
		),
	);

export const publishAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_published, (api) =>
			api.publish(data.id),
		),
	);

export const unpublishAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_unpublished, (api) =>
			api.unpublish(data.id),
		),
	);

export const restoreAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// Re-verify the appointment is still deleted before acting, same as
			// the bulk path — without this, calling restore twice on an
			// already-active appointment would silently succeed again and write
			// a second RESTORE audit log entry.
			const ids = await resolveSelectorIds({ ids: [data.id] }, { not: null });
			if (ids.length === 0) {
				throw new Error(m.appointments_appointment_not_found());
			}
			const [appointment] = await setAppointmentsDeletedState(
				ids,
				null,
				"RESTORE",
				session.id,
			);
			return {
				data: appointment,
				message: m.appointments_appointment_restored(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

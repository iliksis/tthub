import { createServerFn } from "@tanstack/react-start";
import { labelsInclude } from "@/api/labels";
import { prismaClient } from "@/lib/db";
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
	AppointmentType,
	type ResponseType,
	TransactionType,
} from "@/lib/prisma/enums";
import { requireEditor, useAppSession } from "@/lib/session";
import { formatTanstackRouterPath } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { sendNotification } from "./notifications";

type ICreateAppointment =
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

export const createAppointment = createServerFn()
	.validator((d: ICreateAppointment) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// prismaClient.$transaction (DB transaction) is unrelated to the
			// `transaction` model below (the appointment change-history log).
			const appointment = await prismaClient.$transaction(async (tx) => {
				const appointment = await tx.appointment.create({
					data: {
						endDate: data.endDate,
						labels:
							data.type === "HOLIDAY"
								? undefined
								: {
										create: data.labelIds.map((labelId) => ({ labelId })),
									},
						location: data.type === "HOLIDAY" ? undefined : data.location,
						seasonId: data.type === "HOLIDAY" ? undefined : data.seasonId,
						startDate: data.startDate,
						status: data.type === "HOLIDAY" ? undefined : data.status,
						title: data.title,
						type: data.type,
					},
				});
				await tx.transaction.create({
					data: {
						appointmentId: appointment.id,
						type: TransactionType.CREATE,
						userId: session.id,
					},
				});
				return appointment;
			});

			if (
				appointment.type === AppointmentType.TOURNAMENT &&
				appointment.status === AppointmentStatus.PUBLISHED
			) {
				await sendNotification({
					appointmentId: appointment.id,
					body: appointment.title,
					scope: "new",
					title: m.appointments_new_appointment(),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}

			return {
				data: appointment,
				message: m.appointments_appointment_created(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

const appointmentDetailInclude = {
	labels: labelsInclude,
	nextAppointment: true,
	ownTeam: true,
	placements: {
		include: { player: true },
	},
	responses: {
		include: { user: true },
	},
	season: true,
	transactions: {
		include: { user: true },
		orderBy: { createdAt: "desc" },
	},
} satisfies Prisma.AppointmentInclude;

export type AppointmentDetail = Prisma.AppointmentGetPayload<{
	include: typeof appointmentDetailInclude;
}>;

export type AppointmentWithResponses = Appointment & {
	responses: Response[];
	ownTeam: Team | null;
	labels: (AppointmentLabel & { label: Label })[];
};

export const getAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const appointment = await prismaClient.appointment.findUnique({
				include: appointmentDetailInclude,
				where: { id: data.id },
			});
			if (!appointment) {
				throw new Error(m.appointments_appointment_not_found());
			}
			return { data: appointment, message: m.appointments_appointment_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const searchAppointments = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: {
					labels: labelsInclude,
					placements: {
						distinct: "playerId",
					},
				},
				orderBy: { startDate: "desc" },
				take: 10,
				where: {
					deletedAt: null,
					NOT: {
						type: AppointmentType.HOLIDAY,
					},
					OR: [
						{
							title: { contains: data.query ?? "" },
						},
						{
							location: { contains: data.query ?? "" },
						},
					],
				},
			});
			return {
				data: appointments,
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getTransactionsPage = createServerFn()
	.validator(
		(d: {
			skip: number;
			take: number;
			type?: TransactionType;
			query?: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const where: Prisma.TransactionWhereInput = {
				type: data.type,
				...(data.query
					? {
							OR: [
								{ appointment: { title: { contains: data.query } } },
								{ user: { name: { contains: data.query } } },
							],
						}
					: {}),
			};
			// matchedTotal drives "N remaining"/pagination, grandTotal is the
			// unfiltered count used for the "N of TOTAL events" summary.
			const [transactions, matchedTotal, grandTotal] = await Promise.all([
				prismaClient.transaction.findMany({
					include: {
						appointment: true,
						user: true,
					},
					orderBy: { createdAt: "desc" },
					skip: data.skip,
					take: data.take,
					where,
				}),
				prismaClient.transaction.count({ where }),
				prismaClient.transaction.count(),
			]);
			return {
				data: { grandTotal, matchedTotal, transactions },
				message: m.appointments_transactions_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// Lightweight, non-editor-gated feed for the dashboard's "recent activity"
// widget — unlike getTransactionsPage, every logged-in user may see it. To
// keep that safe, it selects only the handful of fields the widget renders
// instead of the editor-only journal's full records: no `changes` (the
// audit diff, which can contain sensitive edit details) and no other
// appointment/user fields.
export const getRecentTransactions = createServerFn({ method: "GET" })
	.validator((d: { take: number }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const transactions = await prismaClient.transaction.findMany({
				orderBy: { createdAt: "desc" },
				select: {
					appointment: { select: { id: true, title: true } },
					createdAt: true,
					id: true,
					type: true,
					user: { select: { name: true } },
				},
				take: data.take,
			});
			return {
				data: transactions,
				message: m.appointments_transactions_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getAppointments = createServerFn()
	.validator(
		(d: {
			title?: string;
			location?: string;
			minDate?: Date;
			withDeleted?: boolean;
			seasonId?: string;
			orderBy?:
				| Prisma.AppointmentOrderByWithRelationInput
				| Prisma.AppointmentOrderByWithRelationInput[];
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: { ownTeam: true, responses: true },
				orderBy: data.orderBy,
				where: {
					deletedAt: data.withDeleted ? undefined : null,
					location: {
						contains: data.location,
					},
					OR: [
						{
							title: { contains: data.title ?? "" },
							type: AppointmentType.TOURNAMENT,
						},
					],
					seasonId: data.seasonId,
					startDate: {
						gt: data.minDate,
					},
				},
			});
			return {
				data: appointments,
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getAppointmentsPage = createServerFn()
	.validator(
		(d: {
			query?: string;
			typeGroup?: "TOURNAMENT" | "TEAM_MATCH";
			responses?: (ResponseType | "NONE")[];
			teamIds?: string[];
			seasonId?: string;
			sortDir?: "asc" | "desc";
			skip: number;
			take: number;
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		const userId = session.data.id;

		try {
			const responseTypes = (data.responses ?? []).filter(
				(r): r is ResponseType => r !== "NONE",
			);
			const wantsNoResponse = (data.responses ?? []).includes("NONE");
			// "no response" and specific response types can't both be expressed
			// through the `responses` relation filter at once (one is `none`,
			// the other `some`), so that combination goes into its own `OR`
			// clause instead — kept separate from the query-text `OR` below via
			// `AND` so Prisma doesn't have to merge two ORs into one.
			const mixedResponseFilter = wantsNoResponse && responseTypes.length > 0;
			const todayStart = new Date();
			todayStart.setHours(0, 0, 0, 0);

			const where: Prisma.AppointmentWhereInput = {
				AND: [
					{
						OR: [
							{ title: { contains: data.query ?? "" } },
							{ location: { contains: data.query ?? "" } },
						],
					},
					mixedResponseFilter
						? {
								OR: [
									{ responses: { none: { userId } } },
									{
										responses: {
											some: { responseType: { in: responseTypes }, userId },
										},
									},
								],
							}
						: {},
				],
				deletedAt: null,
				NOT: { type: AppointmentType.HOLIDAY },
				ownTeamId:
					data.teamIds && data.teamIds.length > 0
						? { in: data.teamIds }
						: undefined,
				responses: mixedResponseFilter
					? undefined
					: wantsNoResponse
						? { none: { userId } }
						: responseTypes.length > 0
							? { some: { responseType: { in: responseTypes }, userId } }
							: undefined,
				seasonId: data.seasonId,
				startDate: { gte: todayStart },
				type:
					data.typeGroup === "TOURNAMENT"
						? AppointmentType.TOURNAMENT
						: data.typeGroup === "TEAM_MATCH"
							? AppointmentType.TEAM_MATCH
							: undefined,
			};

			const [appointments, matchedTotal, grandTotal] = await Promise.all([
				prismaClient.appointment.findMany({
					include: {
						labels: labelsInclude,
						ownTeam: true,
						responses: true,
					},
					orderBy: { startDate: data.sortDir ?? "asc" },
					skip: data.skip,
					take: data.take,
					where,
				}),
				prismaClient.appointment.count({ where }),
				prismaClient.appointment.count({
					where: {
						deletedAt: null,
						NOT: { type: AppointmentType.HOLIDAY },
						seasonId: data.seasonId,
						startDate: { gte: todayStart },
					},
				}),
			]);

			return {
				data: { appointments, grandTotal, matchedTotal },
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

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

// Click-to-edit saves one field at a time, so a burst of edits to the same
// appointment would otherwise fire one notification per field. Debounce so
// only one notification goes out per appointment, ~5s after the last edit.
const pendingUpdateNotifications = new Map<
	string,
	ReturnType<typeof setTimeout>
>();
const UPDATE_NOTIFICATION_DEBOUNCE_MS = 5000;

function scheduleAppointmentUpdatedNotification(appointment: Appointment) {
	const existing = pendingUpdateNotifications.get(appointment.id);
	if (existing) clearTimeout(existing);
	pendingUpdateNotifications.set(
		appointment.id,
		setTimeout(() => {
			pendingUpdateNotifications.delete(appointment.id);
			void sendNotification({
				appointmentId: appointment.id,
				body: appointment.title,
				scope: "updated",
				title: m.appointments_appointment_updated(),
				url: formatTanstackRouterPath("/appts/$apptId", {
					apptId: appointment.id,
				}),
			});
		}, UPDATE_NOTIFICATION_DEBOUNCE_MS),
	);
}

function cancelAppointmentUpdatedNotification(appointmentId: string) {
	const existing = pendingUpdateNotifications.get(appointmentId);
	if (existing) {
		clearTimeout(existing);
		pendingUpdateNotifications.delete(appointmentId);
	}
}

export const updateAppointment = createServerFn()
	.validator(
		(d: {
			id: string;
			updates: Partial<Appointment> & { labelIds?: string[] };
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const { labelIds, ...fieldUpdates } = data.updates;
			const appointment = await prismaClient.$transaction(async (tx) => {
				const before = await tx.appointment.findUniqueOrThrow({
					include: { labels: true },
					where: { id: data.id },
				});
				const appointment = await tx.appointment.update({
					data: {
						endDate: fieldUpdates.endDate,
						link: fieldUpdates.link,
						location: fieldUpdates.location,
						nextAppointmentId: fieldUpdates.nextAppointmentId,
						seasonId: fieldUpdates.seasonId,
						startDate: fieldUpdates.startDate,
						status: fieldUpdates.status,
						title: fieldUpdates.title,
					},
					where: { id: data.id },
				});

				// Only the fields that were part of this save (and actually
				// changed value) are logged, matching click-to-edit's
				// one-field/group-per-save flow.
				const changes: Record<string, { old: unknown; new: unknown }> = {};
				for (const key of Object.keys(fieldUpdates) as (keyof Appointment)[]) {
					if (before[key]?.valueOf() !== appointment[key]?.valueOf()) {
						changes[key] = { new: appointment[key], old: before[key] };
					}
				}

				if (labelIds !== undefined) {
					const beforeLabelIds = before.labels.map((l) => l.labelId);
					const sortedBefore = [...beforeLabelIds].sort();
					const sortedAfter = [...labelIds].sort();
					const labelsChanged =
						sortedBefore.length !== sortedAfter.length ||
						sortedBefore.some((id, i) => id !== sortedAfter[i]);
					if (labelsChanged) {
						await tx.appointmentLabel.deleteMany({
							where: { appointmentId: data.id },
						});
						if (labelIds.length > 0) {
							await tx.appointmentLabel.createMany({
								data: labelIds.map((labelId) => ({
									appointmentId: data.id,
									labelId,
								})),
							});
						}
						// Both old and new label ids are resolved to names in one
						// query so the audit journal reads as label names, not ids —
						// a since-deleted label falls back to its raw id.
						const labelRecords = await tx.label.findMany({
							where: {
								id: { in: [...new Set([...beforeLabelIds, ...labelIds])] },
							},
						});
						const nameById = new Map(labelRecords.map((l) => [l.id, l.name]));
						changes.labels = {
							new: labelIds.map((id) => nameById.get(id) ?? id),
							old: beforeLabelIds.map((id) => nameById.get(id) ?? id),
						};
					}
				}

				if (Object.keys(changes).length > 0) {
					await tx.transaction.create({
						data: {
							appointmentId: appointment.id,
							changes: changes as Prisma.InputJsonValue,
							type: TransactionType.UPDATE,
							userId: session.id,
						},
					});
				}

				return appointment;
			});

			if (appointment.type === AppointmentType.TOURNAMENT) {
				scheduleAppointmentUpdatedNotification(appointment);
			}

			return {
				data: appointment,
				message: m.appointments_appointment_updated(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

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
			// succeed again and write a second DELETE Transaction audit row.
			const ids = await resolveSelectorIds({ ids: [data.id] }, null);
			if (ids.length === 0) {
				throw new Error(m.appointments_appointment_not_found());
			}
			const [appointment] = await setAppointmentsDeletedState(
				ids,
				new Date(),
				TransactionType.DELETE,
				session.id,
				(appointment) => cancelAppointmentUpdatedNotification(appointment.id),
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
// `deletedAt` on a list of ids and log one Transaction row per id, differing
// only in the target `deletedAt` value and the TransactionType.
async function setAppointmentsDeletedState(
	ids: string[],
	deletedAt: Date | null,
	transactionType:
		| typeof TransactionType.DELETE
		| typeof TransactionType.RESTORE,
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
			await tx.transaction.createMany({
				data: batchResults.map((appointment) => ({
					appointmentId: appointment.id,
					type: transactionType,
					userId,
				})),
			});
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
				TransactionType.DELETE,
				session.id,
				(appointment) => cancelAppointmentUpdatedNotification(appointment.id),
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
						await tx.transaction.create({
							data: {
								appointmentId: copy.id,
								type: TransactionType.CREATE,
								userId: session.id,
							},
						});
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
				TransactionType.RESTORE,
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
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const response = await prismaClient.response.upsert({
				create: {
					appointmentId: data.appointmentId,
					responseType: data.response,
					userId: session.data.id,
				},
				update: {
					responseType: data.response,
				},
				where: {
					userId_appointmentId: {
						appointmentId: data.appointmentId,
						userId: session.data.id,
					},
				},
			});
			return { data: response, message: m.appointments_response_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getNextAppointments = createServerFn().handler(async () => {
	try {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const fourWeeks = new Date(now.getTime() + 86400000 * 28);
		const appointments = await prismaClient.appointment.findMany({
			orderBy: {
				startDate: "asc",
			},
			where: {
				AND: [
					{
						startDate: {
							gte: now,
						},
					},
					{
						startDate: {
							lt: fourWeeks,
						},
					},
				],
				deletedAt: null,
				NOT: { type: AppointmentType.HOLIDAY },
			},
		});
		return { data: appointments, message: m.appointments_appointments_found() };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

export const getUserAppointments = createServerFn()
	.validator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: {
					responses: true,
				},
				orderBy: {
					startDate: "asc",
				},
				where: {
					deletedAt: null,
					responses: {
						some: {
							responseType: "ACCEPT",
							userId: data.userId,
						},
					},
					startDate: {
						gte: new Date(),
					},
					type: AppointmentType.TOURNAMENT,
				},
			});
			return {
				data: appointments,
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

// "Open" appointments are ones the user hasn't committed to yet: either no
// response at all, or an explicit "Maybe" (which the rest of the UI already
// treats as the same non-committal state, e.g. appointments/Card.tsx's
// `?? "MAYBE"` fallback for a missing response).
export const getUserOpenAppointments = createServerFn()
	.validator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			const appointments = await prismaClient.appointment.findMany({
				include: {
					responses: true,
				},
				orderBy: {
					startDate: "asc",
				},
				where: {
					deletedAt: null,
					OR: [
						{ responses: { none: { userId: data.userId } } },
						{
							responses: {
								some: { responseType: "MAYBE", userId: data.userId },
							},
						},
					],
					startDate: {
						gte: now,
					},
					type: AppointmentType.TOURNAMENT,
				},
			});
			return {
				data: appointments,
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getCalendarAppointments = createServerFn()
	.validator((d: { start: Date; end: Date; seasonId?: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const start = new Date(data.start);
			const end = new Date(data.end);
			const appointments = await prismaClient.appointment.findMany({
				include: {
					labels: labelsInclude,
				},
				where: {
					deletedAt: null,
					OR: [
						{ endDate: { gte: start } },
						{ endDate: null, startDate: { gte: start } },
					],
					seasonId: data.seasonId,
					startDate: { lt: end },
				},
			});
			const calAppointments = appointments.map((a) => ({
				end: a.endDate ?? a.startDate,
				id: a.id,
				labels: a.labels.map((l) => l.label),
				location: a.location,
				start: a.startDate,
				title: a.title,
				type: a.type,
			}));
			return {
				data: calAppointments,
				message: m.appointments_appointments_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const publishAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			let statusChanged = false;
			const appointment = await prismaClient.$transaction(async (tx) => {
				const before = await tx.appointment.findUniqueOrThrow({
					where: { id: data.id },
				});
				const appointment = await tx.appointment.update({
					data: {
						status: AppointmentStatus.PUBLISHED,
					},
					where: { id: data.id },
				});
				statusChanged = before.status !== appointment.status;
				if (statusChanged) {
					await tx.transaction.create({
						data: {
							appointmentId: appointment.id,
							changes: {
								status: { new: appointment.status, old: before.status },
							} as Prisma.InputJsonValue,
							type: TransactionType.UPDATE,
							userId: session.id,
						},
					});
				}
				return appointment;
			});
			if (statusChanged && appointment.type === AppointmentType.TOURNAMENT) {
				await sendNotification({
					appointmentId: appointment.id,
					body: appointment.title,
					scope: "new",
					title: m.appointments_new_appointment(),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}
			return {
				data: appointment,
				message: m.appointments_appointment_published(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const unpublishAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const appointment = await prismaClient.$transaction(async (tx) => {
				const before = await tx.appointment.findUniqueOrThrow({
					where: { id: data.id },
				});
				const appointment = await tx.appointment.update({
					data: {
						status: AppointmentStatus.DRAFT,
					},
					where: { id: data.id },
				});
				if (before.status !== appointment.status) {
					await tx.transaction.create({
						data: {
							appointmentId: appointment.id,
							changes: {
								status: { new: appointment.status, old: before.status },
							} as Prisma.InputJsonValue,
							type: TransactionType.UPDATE,
							userId: session.id,
						},
					});
				}
				return appointment;
			});
			return {
				data: appointment,
				message: m.appointments_appointment_unpublished(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

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
			// a second RESTORE Transaction audit row.
			const ids = await resolveSelectorIds({ ids: [data.id] }, { not: null });
			if (ids.length === 0) {
				throw new Error(m.appointments_appointment_not_found());
			}
			const [appointment] = await setAppointmentsDeletedState(
				ids,
				null,
				TransactionType.RESTORE,
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

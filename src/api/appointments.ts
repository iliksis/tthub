import { createServerFn } from "@tanstack/react-start";
import { Holiday } from "open-holiday-js";
import { prismaClient } from "@/lib/db";
import type { Appointment, Prisma, Response } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
	TransactionType,
} from "@/lib/prisma/enums";
import { requireEditor, useAppSession } from "@/lib/session";
import { t } from "@/lib/text";
import { formatTanstackRouterPath } from "@/lib/utils";
import { sendNotification } from "./notifications";

type ICreateAppointment =
	| {
			title: string;
			shortTitle: string;
			type: "HOLIDAY";
			startDate: Date;
			endDate: Date | null;
	  }
	| {
			title: string;
			shortTitle: string;
			type: "TOURNAMENT" | "TOURNAMENT_DE";
			startDate: Date;
			endDate: Date | null;
			location: string | null;
			status: AppointmentStatus;
	  };

export const createAppointment = createServerFn()
	.validator((d: ICreateAppointment) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(t("Unauthorized"));
		}

		try {
			// prismaClient.$transaction (DB transaction) is unrelated to the
			// `transaction` model below (the appointment change-history log).
			const appointment = await prismaClient.$transaction(async (tx) => {
				const appointment = await tx.appointment.create({
					data: {
						endDate: data.endDate,
						location: data.type === "HOLIDAY" ? undefined : data.location,
						shortTitle: data.shortTitle,
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
					body: appointment.title,
					scope: "new",
					title: t("New Appointment"),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}

			return { data: appointment, message: t("Appointment created") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

const appointmentDetailInclude = {
	nextAppointment: true,
	placements: {
		include: { player: true },
	},
	responses: {
		include: { user: true },
	},
	transactions: {
		include: { user: true },
		orderBy: { createdAt: "desc" },
	},
} satisfies Prisma.AppointmentInclude;

export type AppointmentDetail = Prisma.AppointmentGetPayload<{
	include: typeof appointmentDetailInclude;
}>;

export type AppointmentWithResponses = Appointment & { responses: Response[] };

export const getAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			throw new Error(t("Unauthorized"));
		}
		try {
			const appointment = await prismaClient.appointment.findUnique({
				include: appointmentDetailInclude,
				where: { id: data.id },
			});
			if (!appointment) {
				throw new Error(t("Appointment not found"));
			}
			return { data: appointment, message: t("Appointment found") };
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
			throw new Error(t("Unauthorized"));
		}
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: {
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
							shortTitle: { contains: data.query ?? "" },
						},
						{
							location: { contains: data.query ?? "" },
						},
					],
				},
			});
			return { data: appointments, message: t("Appointments found") };
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
			sortDirection?: "asc" | "desc";
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(t("Unauthorized"));
		}
		try {
			const where: Prisma.TransactionWhereInput = {
				type: data.type,
				...(data.query
					? {
							OR: [
								{ appointment: { title: { contains: data.query } } },
								{ appointment: { shortTitle: { contains: data.query } } },
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
					orderBy: { createdAt: data.sortDirection ?? "desc" },
					skip: data.skip,
					take: data.take,
					where,
				}),
				prismaClient.transaction.count({ where }),
				prismaClient.transaction.count(),
			]);
			return {
				data: { grandTotal, matchedTotal, transactions },
				message: t("Transactions found"),
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
			orderBy?:
				| Prisma.AppointmentOrderByWithRelationInput
				| Prisma.AppointmentOrderByWithRelationInput[];
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: { responses: true },
				orderBy: data.orderBy,
				where: {
					deletedAt: data.withDeleted ? undefined : null,
					location: {
						contains: data.location,
					},
					OR: [
						{
							OR: [
								{ type: AppointmentType.TOURNAMENT },
								{ type: AppointmentType.TOURNAMENT_DE },
							],
							title: { contains: data.title ?? "" },
						},
						{
							OR: [
								{ type: AppointmentType.TOURNAMENT },
								{ type: AppointmentType.TOURNAMENT_DE },
							],
							shortTitle: { contains: data.title ?? "" },
						},
					],
					startDate: {
						gt: data.minDate,
					},
				},
			});
			return { data: appointments, message: t("Appointments found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getAppointmentsPage = createServerFn()
	.validator(
		(d: {
			query?: string;
			type?: AppointmentType;
			response?: ResponseType | "NONE";
			dateFrom?: Date;
			dateTo?: Date;
			withDeleted?: boolean;
			skip: number;
			take: number;
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(t("Unauthorized"));
		}
		const userId = session.data.id;

		try {
			const where: Prisma.AppointmentWhereInput = {
				deletedAt: data.withDeleted ? undefined : null,
				OR: [
					{ title: { contains: data.query ?? "" } },
					{ shortTitle: { contains: data.query ?? "" } },
					{ location: { contains: data.query ?? "" } },
				],
				responses:
					data.response === "NONE"
						? { none: { userId } }
						: data.response
							? { some: { responseType: data.response, userId } }
							: undefined,
				startDate: {
					gte: data.dateFrom,
					lte: data.dateTo,
				},
				type: data.type,
			};

			const [appointments, matchedTotal, grandTotal] = await Promise.all([
				prismaClient.appointment.findMany({
					include: { responses: true },
					orderBy: { startDate: "desc" },
					skip: data.skip,
					take: data.take,
					where,
				}),
				prismaClient.appointment.count({ where }),
				prismaClient.appointment.count({
					where: { deletedAt: data.withDeleted ? undefined : null },
				}),
			]);

			return {
				data: { appointments, grandTotal, matchedTotal },
				message: t("Appointments found"),
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
				body: appointment.title,
				scope: "updated",
				title: t("Appointment updated"),
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
	.validator((d: { id: string; updates: Partial<Appointment> }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const appointment = await prismaClient.$transaction(async (tx) => {
				const before = await tx.appointment.findUniqueOrThrow({
					where: { id: data.id },
				});
				const appointment = await tx.appointment.update({
					data: {
						endDate: data.updates.endDate,
						link: data.updates.link,
						location: data.updates.location,
						nextAppointmentId: data.updates.nextAppointmentId,
						shortTitle: data.updates.shortTitle,
						startDate: data.updates.startDate,
						status: data.updates.status,
						title: data.updates.title,
					},
					where: { id: data.id },
				});

				// Only the fields that were part of this save (and actually
				// changed value) are logged, matching click-to-edit's
				// one-field/group-per-save flow.
				const changes: Record<string, { old: unknown; new: unknown }> = {};
				for (const key of Object.keys(data.updates) as (keyof Appointment)[]) {
					if (before[key]?.valueOf() !== appointment[key]?.valueOf()) {
						changes[key] = { new: appointment[key], old: before[key] };
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

			return { data: appointment, message: t("Appointment updated") };
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
			throw new Error(t("Unauthorized"));
		}

		try {
			const appointment = await prismaClient.$transaction(async (tx) => {
				const appointment = await tx.appointment.update({
					data: {
						deletedAt: new Date(),
					},
					where: { id: data.id },
				});
				await tx.transaction.create({
					data: {
						appointmentId: appointment.id,
						type: TransactionType.DELETE,
						userId: session.id,
					},
				});
				return appointment;
			});
			cancelAppointmentUpdatedNotification(appointment.id);
			return { data: appointment, message: t("Appointment deleted") };
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
			throw new Error(t("Unauthorized"));
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
			return { data: response, message: t("Response created") };
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
			include: {
				responses: true,
			},
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
				type: AppointmentType.TOURNAMENT,
			},
		});
		return { data: appointments, message: t("Appointments found") };
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
			return { data: appointments, message: t("Appointments found") };
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
			return { data: appointments, message: t("Appointments found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getCalendarAppointments = createServerFn()
	.validator((d: { start: Date; end: Date }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			throw new Error(t("Unauthorized"));
		}
		try {
			const start = new Date(data.start);
			const end = new Date(data.end);
			const appointments = await prismaClient.appointment.findMany({
				where: {
					deletedAt: null,
					OR: [
						{ endDate: { gte: start } },
						{ endDate: null, startDate: { gte: start } },
					],
					startDate: { lt: end },
				},
			});
			const calAppointments = appointments.map((a) => ({
				end: a.endDate ?? a.startDate,
				id: a.id,
				shortTitle: a.shortTitle,
				start: a.startDate,
				title: a.title,
				type: a.type,
			}));
			return { data: calAppointments, message: t("Appointments found") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const importHolidays = createServerFn()
	.validator(
		(d: {
			country: string;
			subdivision?: string;
			startDate: string;
			endDate: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const api = new Holiday();
			const schoolHolidays = await api.getSchoolHolidays(
				data.country,
				new Date(data.startDate),
				new Date(data.endDate),
				data.subdivision,
			);
			const publicHolidays = await api.getPublicHolidays(
				data.country,
				new Date(data.startDate),
				new Date(data.endDate),
				data.subdivision,
			);
			let count = 0;
			for (const holiday of [...schoolHolidays, ...publicHolidays]) {
				const existingAppointment = await prismaClient.appointment.findFirst({
					where: {
						id: holiday.id,
					},
				});
				if (existingAppointment) {
					continue;
				}
				await prismaClient.appointment.create({
					data: {
						endDate: holiday.endDate,
						id: holiday.id,
						shortTitle: holiday.name[0].text,
						startDate: holiday.startDate,
						title: holiday.name[0].text,
						type: AppointmentType.HOLIDAY,
					},
				});
				count++;
			}
			return {
				message:
					count === 1
						? t("1 appointment created")
						: t("{0} Appointments created", count.toString()),
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
			throw new Error(t("Unauthorized"));
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
					body: appointment.title,
					scope: "new",
					title: t("New Appointment"),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}
			return { data: appointment, message: t("Appointment published") };
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
			throw new Error(t("Unauthorized"));
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
			return { data: appointment, message: t("Appointment unpublished") };
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
			throw new Error(t("Unauthorized"));
		}

		try {
			const appointment = await prismaClient.$transaction(async (tx) => {
				const appointment = await tx.appointment.update({
					data: {
						deletedAt: null,
					},
					where: { id: data.id },
				});
				await tx.transaction.create({
					data: {
						appointmentId: appointment.id,
						type: TransactionType.RESTORE,
						userId: session.id,
					},
				});
				return appointment;
			});
			return { data: appointment, message: t("Appointment restored") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

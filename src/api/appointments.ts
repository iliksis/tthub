import { createServerFn, json } from "@tanstack/react-start";
import { Holiday } from "open-holiday-js";
import { prismaClient } from "@/lib/db";
import type { Appointment, Prisma, Response } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { useAppSession, useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import { formatTanstackRouterPath } from "@/lib/utils";
import { sendNotification } from "./notifications";
import type { Return } from "./types";

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
	.inputValidator((d: ICreateAppointment) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.create({
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

			return json<Return<Appointment>>(
				{ data: appointment, message: t("Appointment created") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointment = await prismaClient.appointment.findUnique({
				include: {
					nextAppointment: true,
					placements: {
						include: { player: true },
					},
					responses: {
						include: { user: true },
					},
				},
				where: { id: data.id },
			});
			if (!appointment) {
				return json<Return>(
					{ message: t("Appointment not found") },
					{
						status: 404,
					},
				);
			}
			return json<Return<typeof appointment>>(
				{ data: appointment, message: t("Appointment found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const searchAppointments = createServerFn()
	.inputValidator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (session.data.id === null) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return<typeof appointments>>(
				{ data: appointments, message: t("Appointments found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getAppointments = createServerFn()
	.inputValidator(
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
			return json<Return<typeof appointments>>(
				{ data: appointments, message: t("Appointments found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updateAppointment = createServerFn()
	.inputValidator((d: { id: string; updates: Partial<Appointment> }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
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

			if (appointment.type === AppointmentType.TOURNAMENT) {
				await sendNotification({
					body: appointment.title,
					scope: "updated",
					title: t("Appointment updated"),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}

			return json<Return<Appointment>>(
				{ data: appointment, message: t("Appointment updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deleteAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
				data: {
					deletedAt: new Date(),
				},
				where: { id: data.id },
			});
			return json<Return<Appointment>>(
				{ data: appointment, message: t("Appointment deleted") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const createResponse = createServerFn()
	.inputValidator((d: { appointmentId: string; response: ResponseType }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return<Response>>(
				{ data: response, message: t("Response created") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
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
		return json<Return<typeof appointments>>(
			{ data: appointments, message: t("Appointments found") },
			{ status: 200 },
		);
	} catch (e) {
		console.error(e);
		const error = e as Error;
		return json<Return>({ message: error.message }, { status: 400 });
	}
});

export const getUserAppointments = createServerFn()
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: {
					responses: true,
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
			return json<Return<typeof appointments>>(
				{ data: appointments, message: t("Appointments found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getUserAppointmentsWithoutResponses = createServerFn()
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const now = new Date();
			now.setHours(0, 0, 0, 0);
			const appointments = await prismaClient.appointment.findMany({
				include: {
					responses: true,
				},
				where: {
					deletedAt: null,
					responses: {
						none: {
							userId: data.userId,
						},
					},
					startDate: {
						gte: now,
					},
					type: AppointmentType.TOURNAMENT,
				},
			});
			return json<Return<typeof appointments>>(
				{ data: appointments, message: t("Appointments found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

const colors = {
	HOLIDAY: {
		bg: "var(--catppuccin-color-lavender-400)",
		text: "var(--color-primary-content)",
	},
	TOURNAMENT: {
		bg: "var(--color-success)",
		text: "var(--color-success-content)",
	},
	TOURNAMENT_DE: {
		bg: "var(--catppuccin-color-blue-400)",
		text: "var(--color-primary-content)",
	},
};
export const getCalendarAppointments = createServerFn()
	.inputValidator((d: { start: Date; end: Date }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				include: {
					responses: true,
				},
				where: {
					deletedAt: null,
					startDate: {
						gte: new Date(data.start),
						lt: new Date(data.end),
					},
				},
			});
			const calAppointments = appointments.map((a) => ({
				color: colors[a.type].bg,
				end:
					a.endDate ??
					new Date(
						a.startDate.getFullYear(),
						a.startDate.getMonth(),
						a.startDate.getDate(),
						17,
					),
				extendedProps: {
					shortTitle: a.shortTitle,
				},
				id: a.id,
				start: a.startDate,
				textColor: colors[a.type].text,
				title: a.shortTitle,
			}));
			return json<Return<typeof calAppointments>>(
				{ data: calAppointments, message: t("Appointments found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const importHolidays = createServerFn()
	.inputValidator(
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
			return json<Return>(
				{ message: t("{0} Appointments created", count.toString()) },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const publishAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
				data: {
					status: AppointmentStatus.PUBLISHED,
				},
				where: { id: data.id },
			});
			if (appointment.type === AppointmentType.TOURNAMENT) {
				await sendNotification({
					body: appointment.title,
					scope: "new",
					title: t("New Appointment"),
					url: formatTanstackRouterPath("/appts/$apptId", {
						apptId: appointment.id,
					}),
				});
			}
			return json<Return<Appointment>>(
				{ data: appointment, message: t("Appointment published") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const restoreAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
				data: {
					deletedAt: null,
				},
				where: { id: data.id },
			});
			return json<Return<Appointment>>(
				{ data: appointment, message: t("Appointment restored") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

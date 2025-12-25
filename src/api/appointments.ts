import { createServerFn, json } from "@tanstack/react-start";
import { Holiday } from "open-holiday-js";
import { prismaClient } from "@/lib/db";
import type { Appointment, Prisma, Response } from "@/lib/prisma/client";
import {
	type AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { useAppSession, useIsRole } from "@/lib/session";
import type { Return } from "./types";

type ICreateAppointment =
	| {
			title: string;
			shortTitle: string;
			type: "HOLIDAY";
			startDate: Date;
			endDate?: Date;
	  }
	| {
			title: string;
			shortTitle: string;
			type: "TOURNAMENT_BY" | "TOURNAMENT_DE";
			startDate: Date;
			endDate?: Date;
			location?: string;
			status: AppointmentStatus;
	  };
export const createAppointment = createServerFn()
	.inputValidator((d: ICreateAppointment) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.create({
				data: {
					title: data.title,
					type: data.type,
					shortTitle: data.shortTitle,
					startDate: data.startDate,
					endDate: data.endDate,
					location: data.type === "HOLIDAY" ? undefined : data.location,
					status: data.type === "HOLIDAY" ? undefined : data.status,
				},
			});

			return json<Return<Appointment>>(
				{ message: "Appointment created", data: appointment },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointment = await prismaClient.appointment.findUnique({
				where: { id: data.id },
				include: {
					responses: {
						include: { user: true },
					},
					placements: {
						include: { player: true },
					},
				},
			});
			if (!appointment) {
				return json<Return>(
					{ message: "Appointment not found" },
					{
						status: 404,
					},
				);
			}
			return json<Return<typeof appointment>>(
				{ message: "Appointment found", data: appointment },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getAppointments = createServerFn()
	.inputValidator(
		(d: {
			type: AppointmentType;
			title?: string;
			location?: string;
			withDeleted?: boolean;
			orderBy?:
				| Prisma.AppointmentOrderByWithRelationInput
				| Prisma.AppointmentOrderByWithRelationInput[];
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				where: {
					type: data.type,
					deletedAt: data.withDeleted ? undefined : null,
					location: {
						contains: data.location,
					},
					OR: [
						{ title: { contains: data.title ?? "" } },
						{ shortTitle: { contains: data.title ?? "" } },
					],
				},
				include: { responses: true },
				orderBy: data.orderBy,
			});
			return json<Return<typeof appointments>>(
				{ message: "Appointments found", data: appointments },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updateAppointment = createServerFn()
	.inputValidator((d: { id: string; updates: Partial<Appointment> }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
				where: { id: data.id },
				data: {
					title: data.updates.title,
					startDate: data.updates.startDate,
					endDate: data.updates.endDate,
					location: data.updates.location,
					status: data.updates.status,
					link: data.updates.link,
				},
			});
			return json<Return<Appointment>>(
				{ message: "Appointment updated", data: appointment },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deleteAppointment = createServerFn()
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const appointment = await prismaClient.appointment.update({
				where: { id: data.id },
				data: {
					deletedAt: new Date(),
				},
			});
			return json<Return<Appointment>>(
				{ message: "Appointment deleted", data: appointment },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const createResponse = createServerFn()
	.inputValidator((d: { appointmentId: string; response: ResponseType }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const response = await prismaClient.response.upsert({
				where: {
					userId_appointmentId: {
						userId: session.data.id,
						appointmentId: data.appointmentId,
					},
				},
				update: {
					responseType: data.response,
				},
				create: {
					userId: session.data.id,
					appointmentId: data.appointmentId,
					responseType: data.response,
				},
			});
			return json<Return<Response>>(
				{ message: "Response created", data: response },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getNextAppointments = createServerFn().handler(async () => {
	try {
		const now = new Date();
		const fourWeeks = new Date(now.getTime() + 86400000 * 28);
		const appointments = await prismaClient.appointment.findMany({
			where: {
				AND: [
					{
						startDate: {
							gt: now,
						},
					},
					{
						startDate: {
							lt: fourWeeks,
						},
					},
				],
				deletedAt: null,
				type: AppointmentType.TOURNAMENT_BY,
			},
			include: {
				responses: true,
			},
			orderBy: {
				startDate: "asc",
			},
		});
		return json<Return<typeof appointments>>(
			{ message: "Appointments found", data: appointments },
			{ status: 200 },
		);
	} catch (e) {
		console.log(e);
		const error = e as Error;
		return json<Return>({ message: error.message }, { status: 400 });
	}
});

export const getUserAppointments = createServerFn()
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				where: {
					startDate: {
						gte: new Date(),
					},
					deletedAt: null,
					type: AppointmentType.TOURNAMENT_BY,
					responses: {
						some: {
							userId: data.userId,
							responseType: "ACCEPT",
						},
					},
				},
				include: {
					responses: true,
				},
			});
			return json<Return<typeof appointments>>(
				{ message: "Appointments found", data: appointments },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getUserAppointmentsWithoutResponses = createServerFn()
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				where: {
					startDate: {
						gte: new Date(),
					},
					deletedAt: null,
					type: AppointmentType.TOURNAMENT_BY,
					responses: {
						none: {
							userId: data.userId,
						},
					},
				},
				include: {
					responses: true,
				},
			});
			return json<Return<typeof appointments>>(
				{ message: "Appointments found", data: appointments },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

const colors = {
	TOURNAMENT_BY: {
		bg: "var(--color-success)",
		text: "var(--color-success-content)",
	},
	TOURNAMENT_DE: {
		bg: "var(--catppuccin-color-blue-400)",
		text: "var(--color-primary-content)",
	},
	HOLIDAY: {
		bg: "var(--catppuccin-color-lavender-400)",
		text: "var(--color-primary-content)",
	},
};
export const getCalendarAppointments = createServerFn()
	.inputValidator((d: { start: Date; end: Date }) => d)
	.handler(async ({ data }) => {
		try {
			const appointments = await prismaClient.appointment.findMany({
				where: {
					startDate: {
						gte: new Date(data.start),
						lt: new Date(data.end),
					},
					deletedAt: null,
				},
				include: {
					responses: true,
				},
			});
			const calAppointments = appointments.map((a) => ({
				title: a.shortTitle,
				start: a.startDate,
				end:
					a.endDate ??
					new Date(
						a.startDate.getFullYear(),
						a.startDate.getMonth(),
						a.startDate.getDate(),
						17,
					),
				color: colors[a.type].bg,
				id: a.id,
				textColor: colors[a.type].text,
				extendedProps: {
					shortTitle: a.shortTitle,
				},
			}));
			return json<Return<typeof calAppointments>>(
				{ message: "Appointments found", data: calAppointments },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
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
						id: holiday.id,
						title: holiday.name[0].text,
						shortTitle: holiday.name[0].text,
						startDate: holiday.startDate,
						endDate: holiday.endDate,
						type: AppointmentType.HOLIDAY,
					},
				});
				count++;
			}
			return json<Return>(
				{ message: `${count} Appointments created` },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

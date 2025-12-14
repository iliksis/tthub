import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { Appointment, Prisma } from "@/lib/prisma/client";
import type { AppointmentStatus, AppointmentType } from "@/lib/prisma/enums";
import { useIsRole } from "@/lib/session";
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
			});
			if (!appointment) {
				return json<Return>(
					{ message: "Appointment not found" },
					{
						status: 404,
					},
				);
			}
			return json<Return<Appointment>>(
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
			withDeleted?: boolean;
			orderBy?:
				| Prisma.AppointmentOrderByWithRelationInput
				| Prisma.AppointmentOrderByWithRelationInput[];
		}) => d,
	)
	.handler(async ({ data }) => {
		try {
			const titleFilter: { OR?: Prisma.AppointmentWhereInput[] } = data.title
				? {
						OR: [
							{ title: { contains: data.title } },
							{ shortTitle: { contains: data.title } },
						],
					}
				: {};
			const appointments = await prismaClient.appointment.findMany({
				where: {
					type: data.type,
					deletedAt: data.withDeleted ? undefined : null,
					...titleFilter,
				},
				orderBy: data.orderBy,
			});
			return json<Return<Appointment[]>>(
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

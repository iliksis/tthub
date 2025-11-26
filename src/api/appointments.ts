import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { Appointment } from "@/lib/prisma/client";
import type { AppointmentStatus } from "@/lib/prisma/enums";
import { useIsRole } from "@/lib/session";
import type { Return } from "./types";

type ICreateAppointment =
	| {
			title: string;
			type: "HOLIDAY";
			startDate: Date;
			endDate?: Date;
	  }
	| {
			title: string;
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

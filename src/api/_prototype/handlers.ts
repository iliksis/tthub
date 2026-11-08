// PROTOTYPE. What src/api/appointments.ts would contain: validators + one line.
// Export names and input shapes stay identical, so no consumer changes.
import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import {
	AppointmentsApi,
	type AppointmentUpdates,
	type CreateAppointmentInput,
} from "./appointments.server";
import { run } from "./kernel.server";

export const createAppointment = createServerFn()
	.validator((d: CreateAppointmentInput) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_created, (api) =>
			api.create(data),
		),
	);

export const updateAppointment = createServerFn()
	.validator((d: { id: string; updates: AppointmentUpdates }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_updated, (api) =>
			api.update(data.id, data.updates),
		),
	);

export const getAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_found, (api) =>
			api.get(data.id),
		),
	);

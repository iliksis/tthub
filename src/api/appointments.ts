import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import {
	type Appointment,
	type AppointmentListFilter,
	type AppointmentSelector,
	AppointmentsApi,
	type AppointmentsPageFilter,
	type AppointmentUpdate,
	type BulkAppointmentsPageFilter,
	type CalendarRange,
	type CreateAppointmentInput,
	type ResponseType,
} from "./appointments.server";
import { run } from "./kernel.server";

export type {
	AppointmentDetail,
	AppointmentListFilter,
	AppointmentSelector,
	AppointmentsPageFilter,
	AppointmentUpdate,
	AppointmentWithResponses,
	AppointmentWithSeason,
	BulkAppointmentsFilter,
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

export const getBulkAppointmentsPage = createServerFn()
	.validator((d: BulkAppointmentsPageFilter) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.bulkPage(data),
		),
	);

export const updateAppointment = createServerFn()
	.validator((d: { id: string; updates: AppointmentUpdate }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_updated, (api) =>
			api.update(data.id, data.updates),
		),
	);

export const deleteAppointment = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_deleted, (api) =>
			api.delete(data.id),
		),
	);

export const bulkDeleteAppointments = createServerFn()
	.validator((d: AppointmentSelector) => d)
	.handler(({ data }) =>
		run(
			AppointmentsApi,
			(appointments: Appointment[]) =>
				m.appointments_appointment_deleted_count({
					count: appointments.length,
				}),
			(api) => api.bulkDelete(data),
		),
	);

export const bulkCopyAppointmentsToSeason = createServerFn()
	.validator((d: AppointmentSelector & { targetSeasonId: string }) => d)
	.handler(({ data }) =>
		run(
			AppointmentsApi,
			({ copied, skipped }: { copied: number; skipped: number }) =>
				m.appointments_copied_n_skipped_no_season({
					copied: copied.toString(),
					skipped: skipped.toString(),
				}),
			(api) => api.copyToSeason(data, data.targetSeasonId),
		),
	);

export const getTrashAppointmentsPage = createServerFn()
	.validator((d: BulkAppointmentsPageFilter) => d)
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointments_found, (api) =>
			api.trashPage(data),
		),
	);

export const bulkRestoreAppointments = createServerFn()
	.validator((d: AppointmentSelector) => d)
	.handler(({ data }) =>
		run(
			AppointmentsApi,
			(appointments: Appointment[]) =>
				m.appointments_appointment_restored_count({
					count: appointments.length,
				}),
			(api) => api.bulkRestore(data),
		),
	);

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
	.handler(({ data }) =>
		run(AppointmentsApi, m.appointments_appointment_restored, (api) =>
			api.restore(data.id),
		),
	);

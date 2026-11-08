// PROTOTYPE. Two mutations + two reads of the real AppointmentsApi, written
// with the decided shape. Compare against createAppointment / updateAppointment /
// getAppointment in src/api/appointments.ts.
import { labelsInclude } from "@/api/labels";
import type { Appointment, Prisma } from "@/lib/prisma/client";
import { AppointmentStatus, AppointmentType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";
import { diffFields } from "./journal.server";
import { ApiBase, NotFoundError, type Policies } from "./kernel.server";

export type CreateAppointmentInput =
	| { title: string; type: "HOLIDAY"; startDate: Date; endDate: Date | null }
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

export type AppointmentUpdates = Partial<
	Pick<
		Appointment,
		| "title"
		| "startDate"
		| "endDate"
		| "location"
		| "link"
		| "status"
		| "seasonId"
		| "nextAppointmentId"
	>
> & { labelIds?: string[] };

const toCreateData = (
	i: CreateAppointmentInput,
): Prisma.AppointmentUncheckedCreateInput =>
	i.type === "HOLIDAY"
		? {
				endDate: i.endDate,
				startDate: i.startDate,
				title: i.title,
				type: i.type,
			}
		: {
				endDate: i.endDate,
				labels: { create: i.labelIds.map((labelId) => ({ labelId })) },
				location: i.location,
				seasonId: i.seasonId,
				startDate: i.startDate,
				status: i.status,
				title: i.title,
				type: i.type,
			};

export class AppointmentsApi extends ApiBase {
	// Exhaustive: add a public method without an entry and this stops compiling.
	static readonly policy = {
		create: "EDITOR",
		get: "AUTHENTICATED",
		list: "AUTHENTICATED",
		update: "EDITOR",
	} as const satisfies Policies<AppointmentsApi>;

	async create(input: CreateAppointmentInput) {
		const appointment = await this.tx(async (tx) => {
			const created = await tx.appointment.create({
				data: toCreateData(input),
			});
			await this.journal(tx).created(created.id);
			return created;
		});
		if (
			appointment.type === AppointmentType.TOURNAMENT &&
			appointment.status === AppointmentStatus.PUBLISHED
		) {
			this.ctx.notifier.published(appointment, this.ctx.user?.id ?? null);
		}
		return appointment;
	}

	async update(id: string, updates: AppointmentUpdates) {
		const { labelIds, ...fields } = updates;
		const appointment = await this.tx(async (tx) => {
			const before = await tx.appointment.findUnique({
				include: { labels: true },
				where: { id },
			});
			if (!before) {
				throw new NotFoundError(m.appointments_appointment_not_found());
			}
			const after = await tx.appointment.update({ data: fields, where: { id } });
			const changes = diffFields(
				before,
				after,
				Object.keys(fields) as (keyof Appointment)[],
			);
			if (labelIds) {
				Object.assign(changes, await this.syncLabels(tx, id, before.labels, labelIds));
			}
			await this.journal(tx).updated(id, changes);
			return after;
		});
		if (appointment.type === AppointmentType.TOURNAMENT) {
			this.ctx.notifier.updated(appointment, this.ctx.user?.id ?? null);
		}
		return appointment;
	}

	async get(id: string) {
		const appointment = await this.ctx.db.appointment.findUnique({
			include: { labels: labelsInclude, ownTeam: true, season: true },
			where: { id },
		});
		if (!appointment) {
			throw new NotFoundError(m.appointments_appointment_not_found());
		}
		return appointment;
	}

	async list(seasonId: string) {
		return this.ctx.db.appointment.findMany({
			include: { labels: labelsInclude },
			orderBy: { startDate: "asc" },
			where: { deletedAt: null, seasonId },
		});
	}

	// Domain enrichment stays here and is handed to the journal as plain changes.
	private async syncLabels(
		tx: Prisma.TransactionClient,
		id: string,
		current: { labelId: string }[],
		next: string[],
	) {
		const old = current.map((l) => l.labelId);
		if (
			old.length === next.length &&
			[...old].sort().join() === [...next].sort().join()
		) {
			return {};
		}
		await tx.appointmentLabel.deleteMany({ where: { appointmentId: id } });
		await tx.appointmentLabel.createMany({
			data: next.map((labelId) => ({ appointmentId: id, labelId })),
		});
		const records = await tx.label.findMany({
			where: { id: { in: [...old, ...next] } },
		});
		const names = new Map(records.map((l) => [l.id, l.name]));
		const name = (x: string) => names.get(x) ?? x;
		return { labels: { new: next.map(name), old: old.map(name) } };
	}
}

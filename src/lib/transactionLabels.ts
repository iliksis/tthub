import { TransactionType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

export type TransactionChanges = Record<string, { old: unknown; new: unknown }>;

export const fieldLabels: Record<string, string> = {
	endDate: m.appointments_enddate(),
	link: m.appointments_link(),
	location: m.appointments_location(),
	nextAppointmentId: m.appointments_next_appointment(),
	shortTitle: m.appointments_shorttitle(),
	startDate: m.appointments_startdate(),
	status: m.appointments_status(),
	title: m.common_title(),
};

export const getChangedFields = (
	changes: TransactionChanges | null,
): string[] =>
	Object.keys(changes ?? {}).map((field) => fieldLabels[field] ?? field);

const statusLabels: Record<string, string> = {
	DRAFT: m.appointments_draft(),
	PUBLISHED: m.appointments_published(),
};

const isIsoDateString = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value);

export const formatChangeValue = (field: string, value: unknown): string => {
	if (value === null || value === undefined || value === "") return "—";
	if (field === "status" && typeof value === "string") {
		return statusLabels[value] ?? value;
	}
	if (typeof value === "string" && isIsoDateString(value)) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) {
			return date.toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
			});
		}
	}
	return String(value);
};

export const transactionActionBadge = (
	type: TransactionType,
): { label: string; variant: "success" | "destructive" | "info" } => {
	if (type === TransactionType.CREATE) {
		return { label: m.common_created(), variant: "success" };
	}
	if (type === TransactionType.DELETE) {
		return { label: m.appointments_deleted(), variant: "destructive" };
	}
	if (type === TransactionType.RESTORE) {
		return { label: m.appointments_restored(), variant: "success" };
	}
	return { label: m.appointments_changed(), variant: "info" };
};

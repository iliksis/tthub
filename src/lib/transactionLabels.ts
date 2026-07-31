import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

export type TransactionChanges = Record<string, { old: unknown; new: unknown }>;

export const fieldLabels: Record<string, string> = {
	endDate: t("EndDate"),
	link: t("Link"),
	location: t("Location"),
	nextAppointmentId: t("Next Appointment"),
	shortTitle: t("ShortTitle"),
	startDate: t("StartDate"),
	status: t("Status"),
	title: t("Title"),
};

export const getChangedFields = (
	changes: TransactionChanges | null,
): string[] =>
	Object.keys(changes ?? {}).map((field) => fieldLabels[field] ?? field);

const statusLabels: Record<string, string> = {
	DRAFT: t("Draft"),
	PUBLISHED: t("Published"),
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
		return { label: t("Created"), variant: "success" };
	}
	if (type === TransactionType.DELETE) {
		return { label: t("Deleted"), variant: "destructive" };
	}
	return { label: t("Changed"), variant: "info" };
};

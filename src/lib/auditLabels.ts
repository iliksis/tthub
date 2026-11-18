// UI labels for the audit log (journal), keyed by entity type so a newly
// journalled entity only adds an entry here. Unknown entity types and fields
// fall back to their raw names. See docs/adr/0005.
import type { AuditChanges, AuditEntityType } from "@/lib/auditLog";
import { AuditAction } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

type EntityLabels = {
	fields: Record<string, string>;
	// Labels for enum-like values, per field.
	values?: Record<string, Record<string, string>>;
};

const entityLabels: Record<AuditEntityType, EntityLabels> = {
	Appointment: {
		fields: {
			endDate: m.appointments_enddate(),
			labels: m.labels_labels(),
			link: m.appointments_link(),
			location: m.appointments_location(),
			nextAppointmentId: m.appointments_next_appointment(),
			startDate: m.appointments_startdate(),
			status: m.appointments_status(),
			title: m.common_title(),
		},
		values: {
			status: {
				DRAFT: m.appointments_draft(),
				PUBLISHED: m.appointments_published(),
			},
		},
	},
};

const labelsFor = (entityType: string): EntityLabels | undefined =>
	Object.hasOwn(entityLabels, entityType)
		? entityLabels[entityType as AuditEntityType]
		: undefined;

export const fieldLabel = (entityType: string, field: string): string =>
	labelsFor(entityType)?.fields[field] ?? field;

export const getChangedFields = (
	entityType: string,
	changes: AuditChanges | null,
): string[] =>
	Object.keys(changes ?? {}).map((field) => fieldLabel(entityType, field));

const isIsoDateString = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value);

export const formatChangeValue = (
	entityType: string,
	field: string,
	value: unknown,
): string => {
	if (value === null || value === undefined || value === "") return "—";
	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(", ") : "—";
	}
	if (typeof value === "string") {
		const label = labelsFor(entityType)?.values?.[field]?.[value];
		if (label) return label;
		if (isIsoDateString(value)) {
			const date = new Date(value);
			if (!Number.isNaN(date.getTime())) {
				return date.toLocaleDateString("de-DE", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
				});
			}
		}
	}
	return String(value);
};

export const auditActionBadge = (
	action: AuditAction,
): { label: string; variant: "success" | "destructive" | "info" } => {
	if (action === AuditAction.CREATE) {
		return { label: m.common_created(), variant: "success" };
	}
	if (action === AuditAction.DELETE) {
		return { label: m.appointments_deleted(), variant: "destructive" };
	}
	if (action === AuditAction.RESTORE) {
		return { label: m.appointments_restored(), variant: "success" };
	}
	return { label: m.appointments_changed(), variant: "info" };
};

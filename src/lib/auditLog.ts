// Pure audit-log helpers and types shared by the server (AuditJournal,
// AuditLogApi) and the journal UI (src/lib/auditLabels.ts). See CONTEXT.md
// "Audit Log" and docs/adr/0005.

// Entities that are journalled today. Adding one means a journal call in its
// owning class, a resolver in src/api/auditLog.domain.server.ts and field
// labels in src/lib/auditLabels.ts; the table itself needs no change.
export const AUDIT_ENTITY_TYPES = ["Appointment"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

// The `changes` JSON of an UPDATE entry.
export type AuditChanges = Record<string, { old: unknown; new: unknown }>;

// The listed fields whose value differs between `before` and `after`
// (compared via `valueOf()`, so equal Dates count as unchanged).
export const diffFields = <T extends object>(
	before: T,
	after: T,
	keys: readonly (keyof T & string)[],
): AuditChanges => {
	const changes: AuditChanges = {};
	for (const key of keys) {
		const old = before[key] as unknown;
		const next = after[key] as unknown;
		if (old?.valueOf() !== next?.valueOf()) {
			changes[key] = { new: next, old };
		}
	}
	return changes;
};

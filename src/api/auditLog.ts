import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { AuditLogApi, type AuditLogPageInput } from "./auditLog.server";
import { run } from "./kernel.server";

export type {
	AuditEntry,
	AuditLogPageEntry,
	AuditLogPageInput,
} from "./auditLog.server";

export const getAuditLogPage = createServerFn()
	.validator((d: AuditLogPageInput) => d)
	.handler(({ data }) =>
		run(AuditLogApi, m.audit_entries_found, (api) => api.page(data)),
	);

export const getRecentAuditLog = createServerFn({ method: "GET" })
	.validator((d: { take: number }) => d)
	.handler(({ data }) =>
		run(AuditLogApi, m.audit_entries_found, (api) => api.recent(data)),
	);

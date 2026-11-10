import type { AuditEntityType } from "@/lib/auditLog";
import type { AuditAction, Prisma } from "@/lib/prisma/client";
import {
	auditEntriesFor,
	auditEntryInclude,
	resolveEntities,
	searchEntities,
} from "./auditLog.domain.server";
import { ApiBase, type Policies } from "./kernel.server";

export type { AuditEntry } from "./auditLog.domain.server";
export type AuditLogPageEntry = Awaited<
	ReturnType<AuditLogApi["page"]>
>["entries"][number];

export type AuditLogPageInput = {
	skip: number;
	take: number;
	action?: AuditAction;
	// Matches the entity's name (e.g. an appointment title) or the user's name.
	query?: string;
};

// Reads of the audit log (docs/adr/0005). Writes go through `this.journal(tx)`
// in the class that owns the entity.
export class AuditLogApi extends ApiBase {
	static readonly policy = {
		forEntity: "AUTHENTICATED",
		page: "EDITOR",
		recent: "AUTHENTICATED",
	} as const satisfies Policies<AuditLogApi>;

	// The journal page. `matchedTotal` drives pagination, `grandTotal` (the
	// unfiltered count) the "N of TOTAL events" summary.
	async page({ skip, take, action, query }: AuditLogPageInput) {
		const db = this.ctx.db;
		const where: Prisma.AuditLogWhereInput = {
			action,
			...(query
				? {
						OR: [
							...(await searchEntities(db, query)),
							{ user: { name: { contains: query } } },
						],
					}
				: {}),
		};
		const [rows, matchedTotal, grandTotal] = await Promise.all([
			db.auditLog.findMany({
				include: auditEntryInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
				where,
			}),
			db.auditLog.count({ where }),
			db.auditLog.count(),
		]);
		const entities = await resolveEntities(db, rows);
		const entries = rows.map((row, i) => ({ ...row, entity: entities[i] }));
		return { entries, grandTotal, matchedTotal };
	}

	// The dashboard's "recent activity" feed, open to every logged-in user, so
	// it carries only what that widget renders: no `changes` (the diff can
	// hold sensitive edit details) and no other entity or user fields.
	async recent({ take }: { take: number }) {
		const db = this.ctx.db;
		const rows = await db.auditLog.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				action: true,
				createdAt: true,
				entityId: true,
				entityType: true,
				id: true,
				user: { select: { name: true } },
			},
			take,
		});
		const entities = await resolveEntities(db, rows);
		return rows.map((row, i) => ({
			...row,
			entity: { name: entities[i].name },
		}));
	}

	async forEntity(entityType: AuditEntityType, entityId: string) {
		return auditEntriesFor(this.ctx.db, entityType, entityId);
	}
}

// The audit log's write and read helpers (docs/adr/0005). Plain functions and
// a collaborator taking a `db`/`tx`, so every owning class journals the same
// way, and AuditLogApi plus the appointment detail read entries the same way.
import {
	type AuditChanges,
	type AuditEntityType,
	diffFields,
} from "@/lib/auditLog";
import type { AuditAction, Prisma } from "@/lib/prisma/client";
import { userViewSelect } from "@/lib/users";
import type { Tx } from "./kernel.server";

// The actions that mark an entity's soft delete or restore.
export type SoftDeleteAction = Extract<AuditAction, "DELETE" | "RESTORE">;

// ---- writes ------------------------------------------------------------------
// Writes one entity type's journal entries inside the caller's transaction.
// Domain enrichment (e.g. label ids resolved to names) stays with the owning
// class and arrives as `extraChanges`; the journal never resolves anything.
export class AuditJournal {
	constructor(
		private readonly tx: Tx,
		private readonly entityType: AuditEntityType,
		private readonly actorId: string | null,
	) {}

	async created(entityId: string) {
		await this.tx.auditLog.create({
			data: { action: "CREATE", ...this.target(entityId) },
		});
	}

	// Logs the listed fields that changed plus `extraChanges`; writes nothing
	// when both are empty. Returns what was logged.
	async updated<T extends object>(
		entityId: string,
		before: T,
		after: T,
		fields: readonly (keyof T & string)[],
		extraChanges: AuditChanges = {},
	): Promise<AuditChanges> {
		const changes = { ...diffFields(before, after, fields), ...extraChanges };
		if (Object.keys(changes).length > 0) {
			await this.tx.auditLog.create({
				data: {
					action: "UPDATE",
					changes: changes as Prisma.InputJsonValue,
					...this.target(entityId),
				},
			});
		}
		return changes;
	}

	async softDeleted(entityIds: string[]) {
		await this.many("DELETE", entityIds);
	}

	async restored(entityIds: string[]) {
		await this.many("RESTORE", entityIds);
	}

	private async many(action: SoftDeleteAction, entityIds: string[]) {
		await this.tx.auditLog.createMany({
			data: entityIds.map((id) => ({ action, ...this.target(id) })),
		});
	}

	private target(entityId: string) {
		return { entityId, entityType: this.entityType, userId: this.actorId };
	}
}

// ---- reads -------------------------------------------------------------------
export const auditEntryInclude = {
	user: { select: userViewSelect },
} as const satisfies Prisma.AuditLogInclude;

export type AuditEntry = Prisma.AuditLogGetPayload<{
	include: typeof auditEntryInclude;
}>;

// One entity's entries, newest first.
export const auditEntriesFor = (
	db: Tx,
	entityType: AuditEntityType,
	entityId: string,
): Promise<AuditEntry[]> =>
	db.auditLog.findMany({
		include: auditEntryInclude,
		orderBy: { createdAt: "desc" },
		where: { entityId, entityType },
	});

// What the journal shows for an entry's entity. An unknown type or a missing
// row falls back to the raw id.
export type ResolvedEntity = { name: string; detail: string | null };

type EntityResolver = {
	resolve: (db: Tx, ids: string[]) => Promise<Map<string, ResolvedEntity>>;
	// Ids of entities matching a journal search query.
	search: (db: Tx, query: string) => Promise<string[]>;
};

const resolvers: Record<AuditEntityType, EntityResolver> = {
	// Appointments soft-delete, so deleted ones still resolve.
	Appointment: {
		resolve: async (db, ids) => {
			const rows = await db.appointment.findMany({
				select: { id: true, location: true, title: true },
				where: { id: { in: ids } },
			});
			return new Map(
				rows.map((r) => [r.id, { detail: r.location, name: r.title }]),
			);
		},
		search: async (db, query) => {
			const rows = await db.appointment.findMany({
				select: { id: true },
				where: { title: { contains: query } },
			});
			return rows.map((r) => r.id);
		},
	},
};

const resolverFor = (entityType: string): EntityResolver | undefined =>
	Object.hasOwn(resolvers, entityType)
		? resolvers[entityType as AuditEntityType]
		: undefined;

// Resolves each entry's entity with one query per entity type, in order.
export const resolveEntities = async (
	db: Tx,
	entries: { entityType: string; entityId: string }[],
): Promise<ResolvedEntity[]> => {
	const idsByType = new Map<string, Set<string>>();
	for (const { entityType, entityId } of entries) {
		const ids = idsByType.get(entityType) ?? new Set();
		ids.add(entityId);
		idsByType.set(entityType, ids);
	}
	const resolvedByType = new Map<string, Map<string, ResolvedEntity>>();
	for (const [entityType, ids] of idsByType) {
		const resolver = resolverFor(entityType);
		if (resolver) {
			resolvedByType.set(entityType, await resolver.resolve(db, [...ids]));
		}
	}
	return entries.map(
		({ entityType, entityId }) =>
			resolvedByType.get(entityType)?.get(entityId) ?? {
				detail: null,
				name: entityId,
			},
	);
};

// `OR` branches matching entries whose entity matches `query`, one per type.
export const searchEntities = async (
	db: Tx,
	query: string,
): Promise<Prisma.AuditLogWhereInput[]> =>
	Promise.all(
		Object.entries(resolvers).map(async ([entityType, resolver]) => ({
			entityId: { in: await resolver.search(db, query) },
			entityType,
		})),
	);

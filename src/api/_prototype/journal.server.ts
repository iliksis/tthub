// PROTOTYPE. Explicit audit collaborator (decided). Built per transaction from
// a TransactionClient + the acting user (null for system callers).
// NOTE: writes `transaction` here only because the sketch compiles against the
// current schema; the real design writes `auditLog` with entityType/entityId.
import type { Prisma } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";

export type Changes = Record<string, { old: unknown; new: unknown }>;

// Pure + unit-testable: only keys that were part of the save AND changed.
export const diffFields = <T extends object>(
	before: T,
	after: T,
	keys: (keyof T)[],
): Changes => {
	const changes: Changes = {};
	for (const key of keys) {
		const a = before[key] as { valueOf(): unknown } | null | undefined;
		const b = after[key] as { valueOf(): unknown } | null | undefined;
		if (a?.valueOf() !== b?.valueOf()) {
			changes[key as string] = { new: after[key], old: before[key] };
		}
	}
	return changes;
};

export class AuditJournal {
	constructor(
		private tx: Prisma.TransactionClient,
		private actorId: string | null,
	) {}

	created(entityId: string) {
		return this.tx.transaction.create({
			data: {
				appointmentId: entityId,
				type: TransactionType.CREATE,
				userId: this.actorId,
			},
		});
	}

	// Domain enrichment (e.g. label names) is resolved by the owning class and
	// arrives here as plain `changes`; the journal never resolves names itself.
	async updated(entityId: string, changes: Changes) {
		if (Object.keys(changes).length === 0) return;
		await this.tx.transaction.create({
			data: {
				appointmentId: entityId,
				changes: changes as Prisma.InputJsonValue,
				type: TransactionType.UPDATE,
				userId: this.actorId,
			},
		});
	}
}

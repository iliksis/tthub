import type { LabelColor } from "@/lib/labels";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export type LabelInput = { name: string; color: LabelColor };

export class LabelsApi extends ApiBase {
	static readonly policy = {
		create: "EDITOR",
		delete: "EDITOR",
		list: "AUTHENTICATED",
		reorder: "EDITOR",
		search: "AUTHENTICATED",
		update: "EDITOR",
	} as const satisfies Policies<LabelsApi>;

	async list() {
		return this.ctx.db.label.findMany({ orderBy: { priority: "asc" } });
	}

	async search(query: string | undefined) {
		return this.ctx.db.label.findMany({
			orderBy: { priority: "asc" },
			take: 10,
			where: { name: { contains: query ?? "" } },
		});
	}

	// New labels start at the bottom of the priority list (lowest priority) so
	// creating one never silently outranks an established label's color on
	// existing appointments. Reading the current max and creating in one
	// transaction avoids two concurrent creates colliding on the same priority.
	async create({ name, color }: LabelInput) {
		return this.tx(async (tx) => {
			const highest = await tx.label.aggregate({ _max: { priority: true } });
			return tx.label.create({
				data: { color, name, priority: (highest._max.priority ?? -1) + 1 },
			});
		});
	}

	async update(id: string, { name, color }: LabelInput) {
		return this.tx(async (tx) => {
			await this.requireLabel(tx, id);
			return tx.label.update({ data: { color, name }, where: { id } });
		});
	}

	// `ids` is expected to be the full catalog in its new order, but the
	// client's snapshot can go stale (another editor created or deleted a label
	// while this one was dragging). Reconcile against the current catalog
	// inside the transaction so a stale payload can't orphan or collide
	// priorities: known ids keep the client's order, anything missing is
	// appended afterward in its previous relative order.
	async reorder(ids: string[]) {
		await this.tx(async (tx) => {
			const current = (
				await tx.label.findMany({
					orderBy: { priority: "asc" },
					select: { id: true },
				})
			).map((l) => l.id);
			const known = new Set(current);
			const ordered = ids.filter((id) => known.has(id));
			const placed = new Set(ordered);
			const finalOrder = [
				...ordered,
				...current.filter((id) => !placed.has(id)),
			];
			await Promise.all(
				finalOrder.map((id, priority) =>
					tx.label.update({ data: { priority }, where: { id } }),
				),
			);
		});
	}

	// AppointmentLabel rows cascade-delete automatically (onDelete: Cascade).
	async delete(id: string) {
		await this.tx(async (tx) => {
			await this.requireLabel(tx, id);
			await tx.label.delete({ where: { id } });
		});
	}

	private async requireLabel(tx: Tx, id: string) {
		const label = await tx.label.findUnique({ where: { id } });
		if (!label) throw new NotFoundError(m.labels_label_not_found());
		return label;
	}
}

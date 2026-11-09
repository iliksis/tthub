import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ConflictError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export type PlacementKey = {
	playerId: string;
	appointmentId: string;
	category: string;
};

const whereKey = (key: PlacementKey) => ({
	playerId_appointmentId_category: {
		appointmentId: key.appointmentId,
		category: key.category,
		playerId: key.playerId,
	},
});

export class PlacementsApi extends ApiBase {
	static readonly policy = {
		categories: "AUTHENTICATED",
		create: "EDITOR",
		delete: "EDITOR",
		update: "EDITOR",
	} as const satisfies Policies<PlacementsApi>;

	async categories() {
		const rows = await this.ctx.db.placement.groupBy({ by: ["category"] });
		return rows.map((r) => r.category);
	}

	async create(input: PlacementKey & { placement?: string }) {
		return this.tx(async (tx) => {
			const existing = await tx.placement.findUnique({
				select: { placement: true },
				where: whereKey(input),
			});
			if (existing) {
				throw new ConflictError(
					m.placements_participant_already_exists_in_this_category(),
				);
			}
			return tx.placement.create({
				data: {
					appointmentId: input.appointmentId,
					category: input.category,
					placement: input.placement,
					playerId: input.playerId,
				},
			});
		});
	}

	async update(key: PlacementKey, updates: { placement: string }) {
		return this.tx(async (tx) => {
			await this.requirePlacement(tx, key);
			return tx.placement.update({
				data: { placement: updates.placement },
				where: whereKey(key),
			});
		});
	}

	async delete(key: PlacementKey) {
		return this.tx(async (tx) => {
			await this.requirePlacement(tx, key);
			return tx.placement.delete({ where: whereKey(key) });
		});
	}

	private async requirePlacement(tx: Tx, key: PlacementKey) {
		const placement = await tx.placement.findUnique({
			select: { placement: true },
			where: whereKey(key),
		});
		if (!placement) throw new NotFoundError(m.placements_placement_not_found());
	}
}

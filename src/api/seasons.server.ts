import { recomputeActiveSeasonStatisticsInTransaction } from "@/lib/seasonStatistics";
import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ConflictError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export class SeasonsApi extends ApiBase {
	static readonly policy = {
		active: "AUTHENTICATED",
		create: "EDITOR",
		delete: "EDITOR",
		list: "AUTHENTICATED",
		listWithCounts: "AUTHENTICATED",
		refreshStatistics: "EDITOR",
		setActive: "EDITOR",
		update: "EDITOR",
	} as const satisfies Policies<SeasonsApi>;

	async list() {
		return this.ctx.db.season.findMany({
			orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
		});
	}

	async listWithCounts() {
		return this.ctx.db.season.findMany({
			include: {
				_count: {
					select: {
						appointments: { where: { deletedAt: null } },
						teams: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});
	}

	async active() {
		return this.ctx.db.season.findFirst({ where: { isActive: true } });
	}

	async create(name: string) {
		return this.ctx.db.season.create({ data: { isActive: false, name } });
	}

	async update(id: string, name: string) {
		return this.tx(async (tx) => {
			await this.requireSeason(tx, id);
			return tx.season.update({ data: { name }, where: { id } });
		});
	}

	async setActive(id: string) {
		return this.tx(async (tx) => {
			await this.requireSeason(tx, id);
			await tx.season.updateMany({
				data: { isActive: false },
				where: { isActive: true },
			});
			return tx.season.update({ data: { isActive: true }, where: { id } });
		});
	}

	async refreshStatistics() {
		// Same recompute as the nightly job (src/lib/seasonStatisticsNightly.ts),
		// which has no actor and treats a missing Active Season as a skip; here
		// it is an error the editor must see. Past Seasons stay snapshots.
		const record = await recomputeActiveSeasonStatisticsInTransaction(
			this.ctx.db,
		);
		if (!record) throw new NotFoundError(m.seasons_no_active_season());
		return { computedAt: record.computedAt, seasonId: record.seasonId };
	}

	async delete(id: string) {
		await this.tx(async (tx) => {
			const season = await this.requireSeason(tx, id);
			if (season.isActive) {
				throw new ConflictError(
					m.seasons_the_active_season_cannot_be_deleted(),
				);
			}
			const [teamCount, appointmentCount] = await Promise.all([
				tx.team.count({ where: { seasonId: id } }),
				tx.appointment.count({ where: { deletedAt: null, seasonId: id } }),
			]);
			if (teamCount > 0 || appointmentCount > 0) {
				throw new ConflictError(m.seasons_cannot_delete_while_referenced());
			}
			await tx.season.delete({ where: { id } });
		});
	}

	private async requireSeason(tx: Tx, id: string) {
		const season = await tx.season.findUnique({ where: { id } });
		if (!season) throw new NotFoundError(m.seasons_season_not_found());
		return season;
	}
}

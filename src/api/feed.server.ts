import {
	type FeedConfig,
	parseFeedConfig,
	serializeFeedConfig,
} from "@/lib/feed";
import { labelsInclude } from "@/lib/labels";
import type { Prisma } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";
import { ApiBase, NotFoundError, type Policies } from "./kernel.server";

export class FeedApi extends ApiBase {
	static readonly policy = {
		forFeed: "PUBLIC",
		getConfig: "AUTHENTICATED",
		updateConfig: "AUTHENTICATED",
	} as const satisfies Policies<FeedApi>;

	// The appointments in a user's iCal feed, keyed by their secret feedId
	// (calendar clients have no session) and filtered by their FeedConfig.
	async forFeed(feedId: string) {
		const user = await this.ctx.db.user.findUnique({
			select: { feedConfig: true, id: true },
			where: { feedId },
		});
		if (!user) throw new NotFoundError(m.users_user_not_found());
		const config = parseFeedConfig(user.feedConfig);

		// Deliberately not season-scoped: a personal calendar feed is meant to
		// span season boundaries, so appointments from every season are
		// eligible here.
		const where: Prisma.AppointmentWhereInput = {
			deletedAt: null,
			type: { in: config.includeAppointmentTypes ?? [] },
		};
		if (!config.includeDraftStatus) {
			where.OR = [{ status: "PUBLISHED" }, { status: null }];
		}
		// Exclude-by-label only (no include-by-label): an appointment carrying
		// any excluded label is omitted entirely, regardless of its other labels.
		if (config.excludeLabelIds?.length) {
			where.labels = { none: { labelId: { in: config.excludeLabelIds } } };
		}
		// With response types configured, only appointments the user answered
		// with one of them.
		if (config.includeResponseTypes?.length) {
			where.responses = {
				some: {
					responseType: { in: config.includeResponseTypes },
					userId: user.id,
				},
			};
		}

		return this.ctx.db.appointment.findMany({
			include: { labels: labelsInclude },
			orderBy: { startDate: "asc" },
			where,
		});
	}

	async getConfig() {
		const user = await this.ctx.db.user.findUnique({
			select: { feedConfig: true, feedId: true },
			where: { id: this.requiredActorId },
		});
		if (!user) throw new NotFoundError(m.users_user_not_found());
		return { config: parseFeedConfig(user.feedConfig), feedId: user.feedId };
	}

	async updateConfig(config: FeedConfig) {
		const userId = this.requiredActorId;
		return this.tx(async (tx) => {
			const user = await tx.user.findUnique({
				select: { feedId: true },
				where: { id: userId },
			});
			if (!user) throw new NotFoundError(m.users_user_not_found());
			const data = serializeFeedConfig(config);
			const row = await tx.feedConfig.upsert({
				create: { ...data, userId },
				update: data,
				where: { userId },
			});
			return { config: parseFeedConfig(row), feedId: user.feedId };
		});
	}
}

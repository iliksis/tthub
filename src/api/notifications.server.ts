import { m } from "@/paraglide/messages";
import {
	ApiBase,
	ApiError,
	NotFoundError,
	type Policies,
	type Tx,
} from "./kernel.server";

export type NotificationSettingsInput = {
	subscriptionId: string;
	changedAppointment: boolean;
	newAppointment: boolean;
};

// A device's push subscription and the actor's per-device settings and muted
// labels. Sending pushes is the notifier's job (`ctx.notifier`), not this
// class's.
export class NotificationsApi extends ApiBase {
	static readonly policy = {
		createSubscription: "AUTHENTICATED",
		deleteSubscription: "AUTHENTICATED",
		mutedLabels: "AUTHENTICATED",
		// Pushes to every device of every user.
		sendTest: "ADMIN",
		settings: "AUTHENTICATED",
		subscriptionByAuthKey: "AUTHENTICATED",
		subscriptions: "AUTHENTICATED",
		updateMutedLabels: "AUTHENTICATED",
		updateSettings: "AUTHENTICATED",
	} as const satisfies Policies<NotificationsApi>;

	async createSubscription({
		subscription,
		device,
	}: {
		subscription: PushSubscriptionJSON;
		device: string;
	}) {
		const { endpoint, keys } = subscription;
		if (!endpoint || !keys?.auth || !keys.p256dh) {
			throw new ApiError(m.notifications_invalid_subscription());
		}
		return this.ctx.db.subscription.create({
			data: {
				auth: keys.auth,
				device,
				endpoint,
				p256dh: keys.p256dh,
				userId: this.requiredActorId,
			},
		});
	}

	// The browser's auth key is a secret only its device holds, so holding it
	// is enough to look the subscription up (not restricted to the owner).
	async subscriptionByAuthKey(authKey: string) {
		const subscription = await this.ctx.db.subscription.findUnique({
			where: { auth: authKey },
		});
		if (!subscription) {
			throw new NotFoundError(m.notifications_subscription_not_found());
		}
		return subscription;
	}

	async subscriptions() {
		return this.ctx.db.subscription.findMany({
			where: { userId: this.requiredActorId },
		});
	}

	async deleteSubscription(id: string) {
		await this.tx(async (tx) => {
			await this.requireOwnSubscription(tx, id);
			await tx.notificationSettings.deleteMany({
				where: { subscriptionId: id },
			});
			await tx.subscription.delete({ where: { id } });
		});
	}

	async settings(subscriptionId: string) {
		return this.ctx.db.notificationSettings.findUnique({
			where: {
				userId_subscriptionId: { subscriptionId, userId: this.requiredActorId },
			},
		});
	}

	async updateSettings({
		subscriptionId,
		changedAppointment,
		newAppointment,
	}: NotificationSettingsInput) {
		const userId = this.requiredActorId;
		await this.tx(async (tx) => {
			await this.requireOwnSubscription(tx, subscriptionId);
			await tx.notificationSettings.upsert({
				create: { changedAppointment, newAppointment, subscriptionId, userId },
				update: { changedAppointment, newAppointment },
				where: { userId_subscriptionId: { subscriptionId, userId } },
			});
		});
	}

	async mutedLabels() {
		const muted = await this.ctx.db.userMutedLabel.findMany({
			include: { label: true },
			where: { userId: this.requiredActorId },
		});
		return muted.map((entry) => entry.label);
	}

	// Replaces the actor's muted set; a no-op when it is unchanged.
	async updateMutedLabels(labelIds: string[]) {
		const userId = this.requiredActorId;
		await this.tx(async (tx) => {
			const before = (
				await tx.userMutedLabel.findMany({
					select: { labelId: true },
					where: { userId },
				})
			)
				.map((l) => l.labelId)
				.sort();
			const after = [...new Set(labelIds)].sort();
			if (
				before.length === after.length &&
				before.every((id, i) => id === after[i])
			) {
				return;
			}
			await tx.userMutedLabel.deleteMany({ where: { userId } });
			await tx.userMutedLabel.createMany({
				data: after.map((labelId) => ({ labelId, userId })),
			});
		});
	}

	async sendTest() {
		await this.ctx.notifier.test();
	}

	// Settings and deletion apply only to the actor's own devices; someone
	// else's subscription is reported as not found.
	private async requireOwnSubscription(tx: Tx, id: string) {
		const subscription = await tx.subscription.findFirst({
			where: { id, userId: this.requiredActorId },
		});
		if (!subscription) {
			throw new NotFoundError(m.notifications_subscription_not_found());
		}
	}
}

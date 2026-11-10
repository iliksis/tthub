import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import {
	type NotificationSettingsInput,
	NotificationsApi,
} from "./notifications.server";

export const createNotificationSubscription = createServerFn({ method: "POST" })
	.validator((d: { subscription: PushSubscriptionJSON; device: string }) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.notifications_subscription_created, (api) =>
			api.createSubscription(data),
		),
	);

export const tryGetSubscription = createServerFn({ method: "GET" })
	.validator((d: { authKey: string }) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.notifications_subscription_found, (api) =>
			api.subscriptionByAuthKey(data.authKey),
		),
	);

export const getAllSubscriptions = createServerFn({ method: "GET" }).handler(
	() =>
		run(NotificationsApi, m.notifications_subscriptions_found, (api) =>
			api.subscriptions(),
		),
);

export const deleteNotificationSubscription = createServerFn({ method: "POST" })
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.notifications_subscription_deleted, (api) =>
			api.deleteSubscription(data.id),
		),
	);

export const updateNotificationSettings = createServerFn({ method: "POST" })
	.validator((d: NotificationSettingsInput) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.common_settings_updated, (api) =>
			api.updateSettings(data),
		),
	);

export const getNotificationSettings = createServerFn({ method: "GET" })
	.validator((d: { subscriptionId: string }) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.notifications_settings_found, (api) =>
			api.settings(data.subscriptionId),
		),
	);

export const getMutedLabels = createServerFn({ method: "GET" }).handler(() =>
	run(NotificationsApi, m.notifications_muted_labels_found, (api) =>
		api.mutedLabels(),
	),
);

export const updateMutedLabels = createServerFn({ method: "POST" })
	.validator((d: { labelIds: string[] }) => d)
	.handler(({ data }) =>
		run(NotificationsApi, m.common_settings_updated, (api) =>
			api.updateMutedLabels(data.labelIds),
		),
	);

export const sendTestNotification = createServerFn({ method: "POST" }).handler(
	() =>
		run(NotificationsApi, m.notifications_notifications_sent, (api) =>
			api.sendTest(),
		),
);

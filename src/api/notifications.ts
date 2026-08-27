import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import webpush from "web-push";
import { prismaClient } from "@/lib/db";
import { useAppSession } from "@/lib/session";
import { m } from "@/paraglide/messages";

export const createNotificationSubscription = createServerFn({ method: "POST" })
	.validator((d: { subscription: PushSubscriptionJSON; device: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		if (!data.subscription.keys || !data.subscription.endpoint) {
			throw new Error(m.notifications_invalid_subscription());
		}
		try {
			const subscription = await prismaClient.subscription.create({
				data: {
					auth: data.subscription.keys.auth,
					device: data.device,
					endpoint: data.subscription.endpoint,
					p256dh: data.subscription.keys.p256dh,
					userId: session.data.id,
				},
			});
			return {
				data: subscription,
				message: m.notifications_subscription_created(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const tryGetSubscription = createServerFn({ method: "GET" })
	.validator((d: { authKey: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const subscription = await prismaClient.subscription.findUnique({
				where: {
					auth: data.authKey,
				},
			});
			if (!subscription) {
				throw new Error(m.notifications_subscription_not_found());
			}
			return {
				data: subscription,
				message: m.notifications_subscription_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getAllSubscriptions = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const subscriptions = await prismaClient.subscription.findMany({
				where: {
					userId: session.data.id,
				},
			});
			return {
				data: subscriptions,
				message: m.notifications_subscriptions_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const deleteNotificationSubscription = createServerFn({ method: "POST" })
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const settings = await prismaClient.notificationSettings.findUnique({
				where: {
					userId_subscriptionId: {
						subscriptionId: data.id,
						userId: session.data.id,
					},
				},
			});
			if (settings) {
				await prismaClient.notificationSettings.delete({
					where: {
						userId_subscriptionId: {
							subscriptionId: data.id,
							userId: session.data.id,
						},
					},
				});
			}
			await prismaClient.subscription.delete({
				where: {
					id: data.id,
				},
			});
			return { message: m.notifications_subscription_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateNotificationSettings = createServerFn({ method: "POST" })
	.validator(
		(d: {
			subscriptionId: string;
			changedAppointment: boolean;
			newAppointment: boolean;
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			await prismaClient.notificationSettings.upsert({
				create: {
					changedAppointment: data.changedAppointment,
					newAppointment: data.newAppointment,
					subscriptionId: data.subscriptionId,
					userId: session.data.id,
				},
				update: {
					changedAppointment: data.changedAppointment,
					newAppointment: data.newAppointment,
				},
				where: {
					userId_subscriptionId: {
						subscriptionId: data.subscriptionId,
						userId: session.data.id,
					},
				},
			});
			return { message: m.common_settings_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getNotificationSettings = createServerFn({ method: "GET" })
	.validator((d: { subscriptionId: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			const notificationSettings =
				await prismaClient.notificationSettings.findUnique({
					where: {
						userId_subscriptionId: {
							subscriptionId: data.subscriptionId,
							userId: session.data.id,
						},
					},
				});
			return {
				data: notificationSettings,
				message: m.notifications_settings_found(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const sendTestNotification = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data.id) {
			throw new Error(m.common_unauthorized());
		}
		try {
			webpush.setVapidDetails(
				"mailto:mail@example.com",
				import.meta.env.VITE_VAPID_PUBLIC_KEY,
				process.env.VAPID_PRIVATE_KEY,
			);

			const payload = JSON.stringify({
				badge: "/favicon-96x96.png",
				body: "This is a test notification",
				title: "TT Hub - Test Notification",
				url: "/",
			});

			const subscriptions = await prismaClient.subscription.findMany();
			for (const subscription of subscriptions) {
				await webpush.sendNotification(
					{
						endpoint: subscription.endpoint,
						keys: {
							auth: subscription.auth,
							p256dh: subscription.p256dh,
						},
					},
					payload,
				);
			}

			return { message: m.notifications_notifications_sent() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const sendNotification = createServerOnlyFn(
	async (data: {
		body: string;
		title: string;
		url: string;
		scope: "new" | "updated";
	}) => {
		webpush.setVapidDetails(
			"mailto:mail@example.com",
			import.meta.env.VITE_VAPID_PUBLIC_KEY,
			process.env.VAPID_PRIVATE_KEY,
		);

		const payload = JSON.stringify({
			badge: "/favicon-96x96.png",
			body: data.body,
			title: data.title,
			url: data.url,
		});

		const session = await useAppSession();

		const userSettings = await prismaClient.notificationSettings.findMany({
			include: {
				subscription: true,
			},
			where: {
				changedAppointment: data.scope === "updated" ? true : undefined,
				NOT: {
					userId: session.data.id,
				},
				newAppointment: data.scope === "new" ? true : undefined,
			},
		});
		for (const setting of userSettings) {
			await webpush.sendNotification(
				{
					endpoint: setting.subscription.endpoint,
					keys: {
						auth: setting.subscription.auth,
						p256dh: setting.subscription.p256dh,
					},
				},
				payload,
			);
		}
	},
);

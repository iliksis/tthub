import {
	createServerFn,
	createServerOnlyFn,
	json,
} from "@tanstack/react-start";
import webpush from "web-push";
import { prismaClient } from "@/lib/db";
import type { Subscription } from "@/lib/prisma/client";
import { useAppSession } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const createNotificationSubscription = createServerFn({ method: "POST" })
	.inputValidator(
		(d: { subscription: PushSubscriptionJSON; device: string }) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}
		if (!data.subscription.keys || !data.subscription.endpoint) {
			return json<Return>(
				{ message: t("Invalid subscription") },
				{ status: 400 },
			);
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
			return json<Return<Subscription>>(
				{ data: subscription, message: t("Subscription created") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const tryGetSubscription = createServerFn({ method: "GET" })
	.inputValidator((d: { authKey: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}
		try {
			const subscription = await prismaClient.subscription.findUnique({
				where: {
					auth: data.authKey,
				},
			});
			if (!subscription) {
				return json<Return>(
					{ message: t("Subscription not found") },
					{
						status: 404,
					},
				);
			}
			return json<Return<Subscription>>(
				{ data: subscription, message: t("Subscription found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getAllSubscriptions = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}
		try {
			const subscriptions = await prismaClient.subscription.findMany({
				where: {
					userId: session.data.id,
				},
			});
			return json<Return<Subscription[]>>(
				{ data: subscriptions, message: t("Subscriptions found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	},
);

export const deleteNotificationSubscription = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}
		try {
			await prismaClient.subscription.delete({
				where: {
					id: data.id,
				},
			});
			return json<Return>(
				{ message: t("Subscription deleted") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updateNotificationSettings = createServerFn({ method: "POST" })
	.inputValidator(
		(d: {
			subscriptionId: string;
			changedAppointment: boolean;
			newAppointment: boolean;
		}) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return>({ message: t("Settings updated") }, { status: 200 });
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getNotificationSettings = createServerFn({ method: "GET" })
	.inputValidator((d: { subscriptionId: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return<typeof notificationSettings>>(
				{ data: notificationSettings, message: t("Settings found") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const sendTestNotification = createServerFn({ method: "POST" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data.id) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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

			return json<Return>(
				{ message: t("Notifications sent") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
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

		const userSettings = await prismaClient.notificationSettings.findMany({
			include: {
				subscription: true,
			},
			where: {
				// NOT: {
				// 	userId: session.data.id,
				// },
				changedAppointment: data.scope === "updated" ? true : undefined,
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

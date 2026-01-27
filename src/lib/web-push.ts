import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import DeviceDetector from "node-device-detector";
import React from "react";
import {
	createNotificationSubscription,
	tryGetSubscription,
} from "@/api/notifications";
import { notify } from "@/components/Toast";

const isSupported =
	typeof Notification !== "undefined" && "permission" in Notification;

const isIOS = navigator.userAgent.match(/iPhone|iPad|iPod/i);

const detector = new DeviceDetector({});

export const useNotificationPermissions = () => {
	const router = useRouter();

	const setSubscription = useServerFn(createNotificationSubscription);
	const getSubscription = useServerFn(tryGetSubscription);

	const query = useQuery({
		queryFn: async () => {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.getSubscription();
			const subscriptionJSON = subscription?.toJSON();
			if (subscriptionJSON?.keys?.auth) {
				const response = await getSubscription({
					data: { authKey: subscriptionJSON.keys.auth },
				});
				const result = await response.json();
				if (
					response.status < 400 &&
					isSupported &&
					Notification.permission === "granted"
				) {
					return result.data;
				}
				return null;
			}
		},
		queryKey: ["notification-subscription"],
	});

	const queryClient = useQueryClient();

	const onGrantPermission = React.useCallback(async () => {
		if (isSupported) {
			const permission = await Notification.requestPermission();
			const granted = permission === "granted";

			if (granted) {
				const registration = await navigator.serviceWorker.ready;
				const subscription = await registration.pushManager.subscribe({
					applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
					userVisibleOnly: true,
				});
				const detected = detector.detect(navigator.userAgent);
				const response = await setSubscription({
					data: {
						device: `${detected.os.name} - ${detected.client.name}`,
						subscription: subscription.toJSON(),
					},
				});
				const result = await response.json();
				if (response.status < 400) {
					queryClient.setQueryData(["notification-subscription"], result.data);
					router.invalidate();
				} else {
					notify({ status: "error", title: result.message });
				}
			}
		}
	}, [setSubscription, queryClient.setQueryData, router.invalidate]);

	return {
		isIOS,
		isLoading: query.isLoading,
		isSupported,
		onGrantPermission,
		permissionGranted: !!query.data,
		subscription: query.data,
	};
};

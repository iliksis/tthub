import { useForm } from "@tanstack/react-form";
import { isServer, useQuery } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Trash2Icon } from "lucide-react";
import {
	deleteNotificationSubscription,
	getNotificationSettings,
	sendTestNotification,
	updateNotificationSettings,
} from "@/api/notifications";
import { useMutation } from "@/hooks/useMutation";
import type { Subscription } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { useNotificationPermissions } from "@/lib/web-push";
import { notify } from "../Toast";

type NotificationsProps = {
	subscriptions?: Subscription[] | null;
};
export const Notifications = ({ subscriptions }: NotificationsProps) => {
	const { dev } = useSearch({
		from: "/_authed/settings/profile",
	});

	const {
		permissionGranted,
		onGrantPermission,
		isSupported,
		isIOS,
		isLoading,
		subscription,
	} = useNotificationPermissions();

	if (isLoading) return <div className="loading loading-spinner"></div>;

	return (
		<div className="flex flex-col gap-2">
			<h2 className="mb-2">{t("Notifications")}</h2>
			{!permissionGranted && (
				<button type="button" className="btn" onClick={onGrantPermission}>
					{t("Grant Permission")}
				</button>
			)}
			{isIOS && !isSupported && !isServer && (
				<div className="alert alert-soft alert-info">
					{t(
						"On iOS devices, you must add the website to the home screen before notifications will work.",
					)}
				</div>
			)}
			{!isSupported && !isServer && (
				<div className="alert alert-error alert-soft">
					{t("Notifications are not supported in this browser")}
				</div>
			)}
			{permissionGranted && subscription && (
				<Form subscription={subscription} />
			)}
			<ActiveSubscriptions subscriptions={subscriptions} />
			{dev && (
				<div className="flex flex-col gap-2">
					<button
						type="button"
						className="btn"
						onClick={async () => {
							const registration = await navigator.serviceWorker.ready;
							registration.showNotification("Test Notification", {
								body: "This is a test notification",
								icon: "/favicon-96x96.png",
							});
						}}
					>
						Test Local Notification
					</button>
					<button
						type="button"
						className="btn"
						onClick={async () => {
							await sendTestNotification();
						}}
					>
						Test Server Notification
					</button>
				</div>
			)}
		</div>
	);
};

type FormProps = {
	subscription: Subscription;
};
const Form = ({ subscription }: FormProps) => {
	const router = useRouter();

	const query = useQuery({
		queryFn: async () => {
			const response = await getNotificationSettings({
				data: { subscriptionId: subscription.id },
			});
			const result = await response.json();
			if (response.status < 400) {
				return result.data;
			}
			return null;
		},
		queryKey: ["notification-subscription-settings", subscription.id],
	});

	const mutation = useMutation({
		fn: updateNotificationSettings,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				await query.refetch();
				notify({ status: "success", text: data.message });
				return;
			}
			notify({ status: "error", text: data.message });
		},
	});

	const form = useForm({
		defaultValues: {
			changedAppointment: query.data?.changedAppointment ?? false,
			newAppointment: query.data?.newAppointment ?? false,
		},
		onSubmit: async ({ value, formApi }) => {
			await mutation.mutate({
				data: {
					changedAppointment: value.changedAppointment,
					newAppointment: value.newAppointment,
					subscriptionId: subscription.id,
				},
			});
			formApi.options.defaultValues = {
				changedAppointment: value.changedAppointment,
				newAppointment: value.newAppointment,
			};
		},
	});

	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div>
				<form.Field name="newAppointment">
					{(field) => (
						<label
							className="label whitespace-pre-wrap items-start"
							htmlFor={field.name}
						>
							<input
								id={field.name}
								className="checkbox checkbox-primary"
								type="checkbox"
								name={field.name}
								checked={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.checked)}
							/>
							{t("Get a notification when a new appointment is created")}
						</label>
					)}
				</form.Field>
			</div>
			<div>
				<form.Field name="changedAppointment">
					{(field) => (
						<label
							className="label whitespace-pre-wrap items-start"
							htmlFor={field.name}
						>
							<input
								id={field.name}
								className="checkbox checkbox-primary"
								type="checkbox"
								name={field.name}
								checked={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.checked)}
							/>
							{t("Get a notification when an accepted appointment was changed")}
						</label>
					)}
				</form.Field>
			</div>
			<form.Subscribe
				selector={(state) => [
					state.canSubmit,
					state.isSubmitting,
					state.isDefaultValue,
				]}
			>
				{([canSubmit, isSubmitting, isDefaultValue]) => (
					<button
						type="submit"
						className="btn btn-primary mt-4 w-36"
						disabled={!canSubmit || isDefaultValue}
					>
						{isSubmitting ? "..." : t("Update")}
					</button>
				)}
			</form.Subscribe>
		</form>
	);
};

type ActiveSubscriptionsProps = {
	subscriptions?: Subscription[] | null;
};
const ActiveSubscriptions = ({ subscriptions }: ActiveSubscriptionsProps) => {
	const router = useRouter();

	const deleteSubscription = useServerFn(deleteNotificationSubscription);
	const onDelete = (subscription: Subscription) => async () => {
		const response = await deleteSubscription({
			data: { id: subscription.id },
		});
		const result = await response.json();
		if (response.status < 400) {
			await router.invalidate();
			notify({ status: "success", text: result.message });
			return;
		}
		notify({ status: "error", text: result.message });
	};

	if (!subscriptions || subscriptions.length === 0) return null;
	return (
		<div className="mt-6">
			<h3>{t("Active Subscriptions")}</h3>
			<ul className="list">
				{subscriptions.map((subscription) => (
					<li key={subscription.id} className="list-row">
						<div></div>
						<div>{subscription.device}</div>
						<button
							type="button"
							className="btn btn-square btn-error btn-ghost"
							title={t("Delete")}
							onClick={onDelete(subscription)}
						>
							<Trash2Icon className="size-4" />
						</button>
					</li>
				))}
			</ul>
		</div>
	);
};

import { useForm } from "@tanstack/react-form";
import { isServer, useQuery } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
	deleteNotificationSubscription,
	getNotificationSettings,
	sendTestNotification,
	updateNotificationSettings,
} from "@/api/notifications";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { Subscription } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { useNotificationPermissions } from "@/lib/web-push";

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

	if (isLoading) return <Loader2Icon className="size-4 animate-spin" />;

	return (
		<div className="flex flex-col gap-2">
			<h2 className="mb-2">{t("Notifications")}</h2>
			{!permissionGranted && (
				<Button type="button" variant="secondary" onClick={onGrantPermission}>
					{t("Grant Permission")}
				</Button>
			)}
			{isIOS && !isSupported && !isServer && (
				<Alert variant="info">
					<AlertDescription>
						{t(
							"On iOS devices, you must add the website to the home screen before notifications will work.",
						)}
					</AlertDescription>
				</Alert>
			)}
			{!isSupported && !isServer && (
				<Alert variant="destructive">
					<AlertDescription>
						{t("Notifications are not supported in this browser")}
					</AlertDescription>
				</Alert>
			)}
			{permissionGranted && subscription && (
				<Form subscription={subscription} />
			)}
			<ActiveSubscriptions subscriptions={subscriptions} />
			{dev && (
				<div className="flex flex-col gap-2">
					<Button
						type="button"
						variant="secondary"
						onClick={async () => {
							const registration = await navigator.serviceWorker.ready;
							registration.showNotification("Test Notification", {
								body: "This is a test notification",
								icon: "/favicon-96x96.png",
							});
						}}
					>
						Test Local Notification
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={async () => {
							await sendTestNotification();
						}}
					>
						Test Server Notification
					</Button>
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
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
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
						<div className="flex items-start gap-2">
							<Checkbox
								id={field.name}
								name={field.name}
								checked={field.state.value}
								onBlur={field.handleBlur}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label
								htmlFor={field.name}
								className="whitespace-pre-wrap items-start"
							>
								{t("Get a notification when a new appointment is created")}
							</Label>
						</div>
					)}
				</form.Field>
			</div>
			<div>
				<form.Field name="changedAppointment">
					{(field) => (
						<div className="flex items-start gap-2">
							<Checkbox
								id={field.name}
								name={field.name}
								checked={field.state.value}
								onBlur={field.handleBlur}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							<Label
								htmlFor={field.name}
								className="whitespace-pre-wrap items-start"
							>
								{t(
									"Get a notification when an accepted appointment was changed",
								)}
							</Label>
						</div>
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
					<Button
						type="submit"
						className="mt-4 w-36"
						disabled={!canSubmit || isDefaultValue}
					>
						{isSubmitting ? "..." : t("Update")}
					</Button>
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
			toast.success(result.message);
			return;
		}
		toast.error(result.message);
	};

	if (!subscriptions || subscriptions.length === 0) return null;
	return (
		<div className="mt-6">
			<h3>{t("Active Subscriptions")}</h3>
			<ul className="flex flex-col divide-y divide-border/40">
				{subscriptions.map((subscription) => (
					<li
						key={subscription.id}
						className="flex items-center justify-between gap-2 py-2"
					>
						<div>{subscription.device}</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-destructive hover:text-destructive"
							title={t("Delete")}
							onClick={onDelete(subscription)}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
};

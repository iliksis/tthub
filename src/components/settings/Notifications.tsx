import { useForm } from "@tanstack/react-form";
import { isServer, useQuery } from "@tanstack/react-query";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	BellIcon,
	BellRingIcon,
	CalendarClockIcon,
	Loader2Icon,
	MonitorSmartphoneIcon,
	Trash2Icon,
} from "lucide-react";
import type React from "react";
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
import { useMutation } from "@/hooks/useMutation";
import type { Subscription } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
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

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-1">
				<h2 className="font-semibold text-lg">{t("Notifications")}</h2>
				<p className="text-muted-foreground text-sm">
					{t("Decide when TTHub notifies you on this device.")}
				</p>
			</div>

			{isLoading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<div className="flex flex-col gap-5">
					{!permissionGranted && (
						<div className="flex items-center gap-3 rounded-lg border border-border/60 border-dashed p-4">
							<BellRingIcon className="size-5 shrink-0 text-muted-foreground" />
							<div className="flex-1">
								<div className="font-medium text-sm">{t("Notifications")}</div>
								<div className="text-muted-foreground text-xs">
									{t("Not yet enabled for this device.")}
								</div>
							</div>
							<Button
								type="button"
								variant="secondary"
								onClick={onGrantPermission}
							>
								{t("Grant Permission")}
							</Button>
						</div>
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
				</div>
			)}

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
			className="flex flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="newAppointment">
				{(field) => (
					<ToggleRow
						id={field.name}
						icon={CalendarClockIcon}
						label={t("Get a notification when a new appointment is created")}
						checked={field.state.value}
						onBlur={field.handleBlur}
						onCheckedChange={(checked) => field.handleChange(checked)}
					/>
				)}
			</form.Field>
			<form.Field name="changedAppointment">
				{(field) => (
					<ToggleRow
						id={field.name}
						icon={BellIcon}
						label={t(
							"Get a notification when an accepted appointment was changed",
						)}
						checked={field.state.value}
						onBlur={field.handleBlur}
						onCheckedChange={(checked) => field.handleChange(checked)}
					/>
				)}
			</form.Field>
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
						className="mt-1 w-36"
						disabled={!canSubmit || isDefaultValue}
					>
						{isSubmitting ? "..." : t("Update")}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
};

type ToggleRowProps = {
	id: string;
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	checked: boolean;
	onBlur: () => void;
	onCheckedChange: (checked: boolean) => void;
};
const ToggleRow = ({
	id,
	icon: Icon,
	label,
	checked,
	onBlur,
	onCheckedChange,
}: ToggleRowProps) => (
	<label
		htmlFor={id}
		className={cn(
			"flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors",
			checked && "border-primary/40 bg-primary/5",
		)}
	>
		<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
		<span className="flex-1 text-sm">{label}</span>
		<Checkbox
			id={id}
			checked={checked}
			onBlur={onBlur}
			onCheckedChange={(c) => onCheckedChange(c === true)}
		/>
	</label>
);

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
		<div className="flex flex-col gap-2">
			<span className="text-muted-foreground text-xs uppercase tracking-wide">
				{t("Active Subscriptions")}
			</span>
			<div className="flex flex-col gap-2">
				{subscriptions.map((subscription) => (
					<div
						key={subscription.id}
						className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
					>
						<MonitorSmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
						<span className="flex-1 text-sm">{subscription.device}</span>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="text-destructive hover:text-destructive"
							title={t("Delete")}
							onClick={onDelete(subscription)}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				))}
			</div>
		</div>
	);
};

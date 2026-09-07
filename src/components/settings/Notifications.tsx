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
	TagIcon,
	Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
	deleteNotificationSubscription,
	getMutedLabels,
	getNotificationSettings,
	sendTestNotification,
	updateMutedLabels,
	updateNotificationSettings,
} from "@/api/notifications";
import { LabelMultiSelect } from "@/components/labels/LabelMultiSelect";
import { Section } from "@/components/Section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@/hooks/useMutation";
import type { Label as LabelRecord, Subscription } from "@/lib/prisma/client";
import { cn } from "@/lib/utils";
import { useNotificationPermissions } from "@/lib/web-push";
import { m } from "@/paraglide/messages";

type NotificationsProps = {
	subscriptions?: Subscription[] | null;
	labels?: LabelRecord[];
};
export const Notifications = ({
	subscriptions,
	labels,
}: NotificationsProps) => {
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
		<Section title={m.notifications_notifications()}>
			<p className="mb-4 text-muted-foreground text-sm">
				{m.notifications_decide_when_tthub_notifies_you_on_this_device()}
			</p>

			{isLoading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<div className="flex flex-col gap-5">
					{!permissionGranted && (
						<div className="flex items-center gap-3 rounded-lg border border-border/60 border-dashed p-4">
							<BellRingIcon className="size-5 shrink-0 text-muted-foreground" />
							<div className="flex-1">
								<div className="font-medium text-sm">
									{m.notifications_notifications()}
								</div>
								<div className="text-muted-foreground text-xs">
									{m.notifications_not_yet_enabled_for_this_device()}
								</div>
							</div>
							<Button
								type="button"
								variant="secondary"
								onClick={onGrantPermission}
							>
								{m.notifications_grant_permission()}
							</Button>
						</div>
					)}
					{isIOS && !isSupported && !isServer && (
						<Alert variant="info">
							<AlertDescription>
								{m.notifications_ios_add_to_home_screen()}
							</AlertDescription>
						</Alert>
					)}
					{!isSupported && !isServer && (
						<Alert variant="destructive">
							<AlertDescription>
								{m.notifications_not_supported_in_this_browser()}
							</AlertDescription>
						</Alert>
					)}
					{permissionGranted && subscription && (
						<Form subscription={subscription} />
					)}
					<ActiveSubscriptions subscriptions={subscriptions} />
				</div>
			)}

			{labels && labels.length > 0 && (
				<div className="mt-5">
					<MutedLabelsSection labels={labels} />
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
		</Section>
	);
};

type FormProps = {
	subscription: Subscription;
};
const Form = ({ subscription }: FormProps) => {
	const router = useRouter();

	const query = useQuery({
		queryFn: async () => {
			try {
				const response = await getNotificationSettings({
					data: { subscriptionId: subscription.id },
				});
				return response.data;
			} catch {
				return null;
			}
		},
		queryKey: ["notification-subscription-settings", subscription.id],
	});

	const mutation = useMutation({
		fn: updateNotificationSettings,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			await query.refetch();
			toast.success(ctx.data.message);
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
						label={m.notifications_get_a_notification_when_a_new_appointment_is_created()}
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
						label={m.notifications_get_a_notification_when_an_accepted_appointment_was_changed()}
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
						{isSubmitting ? m.common_loading() : m.common_update()}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
};

type MutedLabelsSectionProps = {
	labels: LabelRecord[];
};
const MutedLabelsSection = ({ labels }: MutedLabelsSectionProps) => {
	// Deliberately does NOT catch inside queryFn: updateMutedLabels below
	// replaces the user's entire muted set, so a query that silently fell
	// back to `[]` on a transient fetch failure would make the very next
	// save wipe out mutes the user never touched. useQuery's own
	// isLoading/isError states drive the render instead — the picker only
	// ever appears once we know what's actually stored.
	const query = useQuery({
		queryFn: async () => {
			const response = await getMutedLabels();
			return response.data ?? [];
		},
		queryKey: ["muted-labels"],
	});

	const [selected, setSelected] = React.useState<LabelRecord[]>([]);
	React.useEffect(() => {
		if (query.data) setSelected(query.data);
	}, [query.data]);

	const mutation = useMutation({
		fn: updateMutedLabels,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await query.refetch();
			toast.success(ctx.data.message);
		},
	});

	const currentIds = (query.data ?? []).map((l) => l.id).sort();
	const selectedIds = selected.map((l) => l.id).sort();
	const isDirty = JSON.stringify(currentIds) !== JSON.stringify(selectedIds);

	return (
		<div className="flex flex-col gap-3" data-testid="muted-labels-section">
			<div>
				<div className="flex items-center gap-2 font-medium text-sm">
					<TagIcon className="size-4 text-muted-foreground" />
					{m.notifications_mute_by_label()}
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					{m.notifications_mute_by_label_description()}
				</p>
			</div>
			{query.isLoading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : query.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{m.notifications_could_not_load_muted_labels()}{" "}
						<button
							type="button"
							className="underline hover:cursor-pointer"
							onClick={() => query.refetch()}
						>
							{m.common_try_again()}
						</button>
					</AlertDescription>
				</Alert>
			) : (
				<>
					<LabelMultiSelect
						availableLabels={labels}
						selectedIds={selected.map((l) => l.id)}
						allowCreate={false}
						onChange={setSelected}
					/>
					<Button
						type="button"
						className="w-fit"
						disabled={!isDirty || mutation.status === "pending"}
						onClick={() =>
							mutation.mutate({ data: { labelIds: selected.map((l) => l.id) } })
						}
					>
						{mutation.status === "pending"
							? m.common_loading()
							: m.common_update()}
					</Button>
				</>
			)}
		</div>
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
		try {
			const result = await deleteSubscription({
				data: { id: subscription.id },
			});
			await router.invalidate();
			toast.success(result.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	if (!subscriptions || subscriptions.length === 0) return null;
	return (
		<div className="flex flex-col gap-2">
			<span className="text-muted-foreground text-xs uppercase tracking-wide">
				{m.notifications_active_subscriptions()}
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
							title={m.common_delete()}
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

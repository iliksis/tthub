import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import {
	CalendarClockIcon,
	CopyIcon,
	LinkIcon,
	ListFilterIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { type FeedConfig, updateFeedConfig } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

const responseTypeMeta: Record<ResponseType, { label: string }> = {
	ACCEPT: { label: t("Accepted") },
	DECLINE: { label: t("Declined") },
	MAYBE: { label: t("Maybe") },
};
const responseTypeOrder: ResponseType[] = ["ACCEPT", "MAYBE", "DECLINE"];

const appointmentTypeMeta: Record<AppointmentType, { label: string }> = {
	HOLIDAY: { label: t("Holiday") },
	TOURNAMENT: { label: t("Tournament") },
	TOURNAMENT_DE: { label: t("Tournament (Germany)") },
};
const appointmentTypeOrder: AppointmentType[] = [
	"TOURNAMENT",
	"TOURNAMENT_DE",
	"HOLIDAY",
];

function Tile({
	icon: Icon,
	title,
	description,
	className,
	children,
}: {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`flex flex-col gap-4 rounded-lg border border-border/60 p-4 ${className ?? ""}`}
		>
			<div className="flex items-center gap-2">
				<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
					<Icon className="size-4" />
				</div>
				<div>
					<div className="font-bold text-sm">{title}</div>
					{description && (
						<div className="text-muted-foreground text-xs">{description}</div>
					)}
				</div>
			</div>
			{children}
		</div>
	);
}

type CalendarFeedProps = {
	feedId?: string;
	config?: FeedConfig | null;
};
export const CalendarFeed = ({ config, feedId }: CalendarFeedProps) => {
	const router = useRouter();

	const updateMutation = useMutation({
		fn: updateFeedConfig,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				toast.success(data.message);
				router.invalidate();
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			includeAppointmentTypes: config?.includeAppointmentTypes || [],
			includeDraftStatus: config?.includeDraftStatus ?? false,
			includeResponseTypes: config?.includeResponseTypes || [],
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutate({ data: value });
		},
	});

	// Starts empty (matching SSR, which has no window) and fills in after mount,
	// so the client's first paint matches the server and hydration doesn't mismatch.
	const [feedUrl, setFeedUrl] = React.useState("");
	React.useEffect(() => {
		if (feedId) setFeedUrl(`${window.location.origin}/feed/${feedId}`);
	}, [feedId]);

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(feedUrl);
		toast.success(t("Feed URL copied to clipboard"));
	};

	const toggleResponseType = (
		type: ResponseType,
		current: ResponseType[],
		onChange: (v: ResponseType[]) => void,
	) => {
		if (current.includes(type)) {
			onChange(current.filter((v) => v !== type));
		} else {
			onChange([...current, type]);
		}
	};

	const toggleAppointmentType = (
		type: AppointmentType,
		current: AppointmentType[],
		onChange: (v: AppointmentType[]) => void,
	) => {
		if (current.includes(type)) {
			onChange(current.filter((v) => v !== type));
		} else {
			onChange([...current, type]);
		}
	};

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="flex flex-col gap-1">
				<h2 className="font-bold text-2xl">{t("Calendar Feed")}</h2>
				<p className="text-muted-foreground text-sm">
					{t(
						"Subscribe to your personalized calendar feed to receive appointment updates in your calendar app",
					)}
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				{feedUrl && (
					<Tile
						icon={LinkIcon}
						title={t("Your Feed URL")}
						description={t(
							"Use this URL in your calendar application to subscribe to your personal calendar feed.",
						)}
						className="lg:col-span-2"
					>
						<div className="flex gap-2">
							<Input type="text" readOnly value={feedUrl} />
							<Button type="button" onClick={handleCopyUrl}>
								<CopyIcon />
								{t("Copy")}
							</Button>
						</div>
					</Tile>
				)}

				<Tile
					icon={ListFilterIcon}
					title={t("Response Types")}
					description={t(
						"Leave all unchecked to include all appointments regardless of response",
					)}
				>
					<form.Field name="includeResponseTypes">
						{(field) => (
							<div className="flex flex-col gap-2">
								{responseTypeOrder.map((type) => (
									<div key={type} className="flex items-center gap-2">
										<Checkbox
											id={`response-${type}`}
											checked={(field.state.value as ResponseType[]).includes(
												type,
											)}
											onCheckedChange={() =>
												toggleResponseType(
													type,
													field.state.value as ResponseType[],
													field.handleChange,
												)
											}
										/>
										<Label htmlFor={`response-${type}`}>
											{responseTypeMeta[type].label}
										</Label>
									</div>
								))}
							</div>
						)}
					</form.Field>
				</Tile>

				<Tile icon={CalendarClockIcon} title={t("Appointment Types")}>
					<form.Field name="includeAppointmentTypes">
						{(field) => (
							<div className="flex flex-col gap-2">
								{appointmentTypeOrder.map((type) => (
									<div key={type} className="flex items-center gap-2">
										<Checkbox
											id={`type-${type}`}
											checked={(
												field.state.value as AppointmentType[]
											).includes(type)}
											onCheckedChange={() =>
												toggleAppointmentType(
													type,
													field.state.value as AppointmentType[],
													field.handleChange,
												)
											}
										/>
										<Label htmlFor={`type-${type}`}>
											{appointmentTypeMeta[type].label}
										</Label>
									</div>
								))}
							</div>
						)}
					</form.Field>
				</Tile>

				<Tile
					icon={SlidersHorizontalIcon}
					title={t("Configuration")}
					className="lg:col-span-2"
				>
					<form.Field name="includeDraftStatus">
						{(field) => (
							<div className="flex items-center gap-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) =>
										field.handleChange(checked === true)
									}
								/>
								<Label htmlFor={field.name}>
									{t("Include draft appointments")}
								</Label>
							</div>
						)}
					</form.Field>
				</Tile>
			</div>

			<Button
				type="submit"
				className="w-36"
				disabled={updateMutation.status === "pending"}
			>
				{updateMutation.status === "pending" ? "..." : t("Update")}
			</Button>
		</form>
	);
};

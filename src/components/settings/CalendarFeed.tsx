import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { CopyIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { type FeedConfig, updateFeedConfig } from "@/api/users";
import { Section } from "@/components/Section";
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
	TEAM_MATCH: { label: t("Team Match") },
	TOURNAMENT: { label: t("Tournament") },
	TOURNAMENT_DE: { label: t("Tournament (Germany)") },
};
const appointmentTypeOrder: AppointmentType[] = [
	"TOURNAMENT",
	"TOURNAMENT_DE",
	"HOLIDAY",
	"TEAM_MATCH",
];

type CalendarFeedProps = {
	feedId?: string;
	config?: FeedConfig | null;
};
export const CalendarFeed = ({ config, feedId }: CalendarFeedProps) => {
	const router = useRouter();

	const updateMutation = useMutation({
		fn: updateFeedConfig,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			toast.success(ctx.data.message);
			router.invalidate();
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
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{feedUrl && (
					<div className="lg:col-span-2">
						<Section
							title={t("Your Feed URL")}
							description={t(
								"Use this URL in your calendar application to subscribe to your personal calendar feed.",
							)}
						>
							<div className="flex gap-2">
								<Input type="text" readOnly value={feedUrl} />
								<Button type="button" onClick={handleCopyUrl}>
									<CopyIcon />
									{t("Copy")}
								</Button>
							</div>
						</Section>
					</div>
				)}

				<Section
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
				</Section>

				<Section title={t("Appointment Types")}>
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
				</Section>

				<Section title={t("Configuration")}>
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
				</Section>
			</div>

			<Button
				type="submit"
				className="w-36"
				disabled={updateMutation.status === "pending"}
			>
				{updateMutation.status === "pending" ? t("Loading…") : t("Update")}
			</Button>
		</form>
	);
};

import { useForm } from "@tanstack/react-form";
import { isServer } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { type FeedConfig, updateFeedConfig } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

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

	const feedUrl =
		feedId && !isServer ? `${window.location.origin}/feed/${feedId}` : "";

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(feedUrl);
		toast.success(t("Feed URL copied to clipboard"));
	};

	const toggleResponseType = (type: ResponseType, field: any) => {
		const current = field.state.value as ResponseType[];
		if (current.includes(type)) {
			field.handleChange(current.filter((t) => t !== type));
		} else {
			field.handleChange([...current, type]);
		}
	};

	const toggleAppointmentType = (type: AppointmentType, field: any) => {
		const current = field.state.value as AppointmentType[];
		if (current.includes(type)) {
			field.handleChange(current.filter((t) => t !== type));
		} else {
			field.handleChange([...current, type]);
		}
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<div className="space-y-6">
				<div>
					<h2 className="text-2xl font-bold mb-4">{t("Calendar Feed")}</h2>
					<p className="text-gray-600 dark:text-gray-400 mb-4">
						{t(
							"Subscribe to your personalized calendar feed to receive appointment updates in your calendar app",
						)}
					</p>
				</div>

				{feedUrl && (
					<div>
						<div className="block text-md font-medium mb-2">
							{t("Your Feed URL")}
						</div>
						<div className="flex gap-2">
							<Input type="text" readOnly value={feedUrl} />
							<Button type="button" onClick={handleCopyUrl}>
								{t("Copy")}
							</Button>
						</div>
						<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
							{t(
								"Use this URL in your calendar application to subscribe to your personal calendar feed.",
							)}
						</p>
					</div>
				)}

				<div className="divider"></div>

				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-semibold mb-3">{t("Configuration")}</h3>
					</div>

					<form.Field name="includeResponseTypes">
						{(field) => (
							<div>
								<div className="block text-sm font-medium mb-3">
									{t("Response Types")}
								</div>
								<div className="space-y-2 flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-accept`}
											checked={(field.state.value as ResponseType[]).includes(
												"ACCEPT",
											)}
											onCheckedChange={() =>
												toggleResponseType("ACCEPT", field)
											}
										/>
										<Label htmlFor={`${field.name}-accept`}>
											{t("Accepted")}
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-maybe`}
											checked={(field.state.value as ResponseType[]).includes(
												"MAYBE",
											)}
											onCheckedChange={() => toggleResponseType("MAYBE", field)}
										/>
										<Label htmlFor={`${field.name}-maybe`}>{t("Maybe")}</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-decline`}
											checked={(field.state.value as ResponseType[]).includes(
												"DECLINE",
											)}
											onCheckedChange={() =>
												toggleResponseType("DECLINE", field)
											}
										/>
										<Label htmlFor={`${field.name}-decline`}>
											{t("Declined")}
										</Label>
									</div>
								</div>
								<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
									{t(
										"Leave all unchecked to include all appointments regardless of response",
									)}
								</p>
							</div>
						)}
					</form.Field>

					<form.Field name="includeAppointmentTypes">
						{(field) => (
							<div>
								<div className="block text-sm font-medium mb-2">
									{t("Appointment Types")}
								</div>
								<div className="space-y-2 flex flex-col gap-2">
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-tournament`}
											checked={(
												field.state.value as AppointmentType[]
											).includes("TOURNAMENT")}
											onCheckedChange={() =>
												toggleAppointmentType("TOURNAMENT", field)
											}
										/>
										<Label htmlFor={`${field.name}-tournament`}>
											{t("Tournament")}
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-tournament-de`}
											checked={(
												field.state.value as AppointmentType[]
											).includes("TOURNAMENT_DE")}
											onCheckedChange={() =>
												toggleAppointmentType("TOURNAMENT_DE", field)
											}
										/>
										<Label htmlFor={`${field.name}-tournament-de`}>
											{t("Tournament (Germany)")}
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											id={`${field.name}-holiday`}
											checked={(
												field.state.value as AppointmentType[]
											).includes("HOLIDAY")}
											onCheckedChange={() =>
												toggleAppointmentType("HOLIDAY", field)
											}
										/>
										<Label htmlFor={`${field.name}-holiday`}>
											{t("Holiday")}
										</Label>
									</div>
								</div>
							</div>
						)}
					</form.Field>

					<form.Field name="includeDraftStatus">
						{(field) => (
							<div>
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
							</div>
						)}
					</form.Field>
				</div>

				<div className="pt-4">
					<Button type="submit" disabled={updateMutation.status === "pending"}>
						{updateMutation.status === "pending" ? "..." : t("Update")}
					</Button>
				</div>
			</div>
		</form>
	);
};

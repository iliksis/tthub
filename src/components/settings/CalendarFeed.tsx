import { useForm } from "@tanstack/react-form";
import { isServer } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { type FeedConfig, updateFeedConfig } from "@/api/users";
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
							<input type="text" readOnly value={feedUrl} className="input" />
							<button
								type="button"
								onClick={handleCopyUrl}
								className="btn btn-primary"
							>
								{t("Copy")}
							</button>
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
									<label className="label">
										<input
											type="checkbox"
											checked={(field.state.value as ResponseType[]).includes(
												"ACCEPT",
											)}
											onChange={() => toggleResponseType("ACCEPT", field)}
											className="checkbox checkbox-primary"
										/>
										{t("Accepted")}
									</label>
									<label className="label">
										<input
											type="checkbox"
											checked={(field.state.value as ResponseType[]).includes(
												"MAYBE",
											)}
											onChange={() => toggleResponseType("MAYBE", field)}
											className="checkbox checkbox-primary"
										/>
										{t("Maybe")}
									</label>
									<label className="label">
										<input
											type="checkbox"
											checked={(field.state.value as ResponseType[]).includes(
												"DECLINE",
											)}
											onChange={() => toggleResponseType("DECLINE", field)}
											className="checkbox checkbox-primary"
										/>
										{t("Declined")}
									</label>
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
									<label className="label">
										<input
											type="checkbox"
											checked={(
												field.state.value as AppointmentType[]
											).includes("TOURNAMENT")}
											onChange={() =>
												toggleAppointmentType("TOURNAMENT", field)
											}
											className="checkbox checkbox-primary"
										/>
										{t("Tournament")}
									</label>
									<label className="label">
										<input
											type="checkbox"
											checked={(
												field.state.value as AppointmentType[]
											).includes("TOURNAMENT_DE")}
											onChange={() =>
												toggleAppointmentType("TOURNAMENT_DE", field)
											}
											className="checkbox checkbox-primary"
										/>
										{t("Tournament (Germany)")}
									</label>
									<label className="label">
										<input
											type="checkbox"
											checked={(
												field.state.value as AppointmentType[]
											).includes("HOLIDAY")}
											onChange={() => toggleAppointmentType("HOLIDAY", field)}
											className="checkbox checkbox-primary"
										/>
										{t("Holiday")}
									</label>
								</div>
							</div>
						)}
					</form.Field>

					<form.Field name="includeDraftStatus">
						{(field) => (
							<div>
								<label className="label">
									<input
										type="checkbox"
										checked={field.state.value}
										onChange={(e) => field.handleChange(e.target.checked)}
										className="checkbox checkbox-primary"
									/>
									{t("Include draft appointments")}
								</label>
							</div>
						)}
					</form.Field>
				</div>

				<div className="pt-4">
					<button
						type="submit"
						disabled={updateMutation.status === "pending"}
						className="btn btn-primary"
					>
						{updateMutation.status === "pending" ? "..." : t("Update")}
					</button>
				</div>
			</div>
		</form>
	);
};

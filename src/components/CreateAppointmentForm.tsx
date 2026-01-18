import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { createAppointment } from "@/api/appointments";
import { useMutation } from "@/hooks/useMutation";
import { AppointmentStatus } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { dateToInputValue } from "@/lib/utils";
import {
	type AppointmentType,
	CreateAppointmentProvider,
	type TournamentType,
	useCreateAppointmentContext,
} from "./CreateAppointmentForm.context";
import { notify } from "./Toast";

const types: { key: AppointmentType; value: string }[] = [
	{ key: "holiday", value: t("Holiday") },
	{ key: "tournament", value: t("Tournament") },
] as const;
const tournamentAreas: { key: TournamentType; value: string }[] = [
	{ key: "bavaria", value: t("Bavaria") },
	{ key: "germany", value: t("Germany") },
] as const;

export const CreateAppointmentForm = () => {
	return (
		<CreateAppointmentProvider>
			<AppointmentTypeSelect />
			<div className="divider"></div>
			<AppointmentEditSection />
		</CreateAppointmentProvider>
	);
};

const AppointmentTypeSelect = () => {
	const { state, dispatch } = useCreateAppointmentContext();

	return (
		<fieldset className="fieldset">
			<legend className="fieldset-legend">{t("Appointment type")}</legend>
			<div className="flex gap-2">
				<select
					className="select select-primary w-1/2"
					onChange={(e) => {
						dispatch({
							payload: e.target.value as AppointmentType,
							type: "SET_TYPE",
						});
					}}
				>
					<option disabled selected>
						{t("Choose a type")}
					</option>
					{types.map((t) => (
						<option key={t.key} value={t.key}>
							{t.value}
						</option>
					))}
				</select>
				{state.type === "tournament" && (
					<select
						className="select select-primary w-1/2"
						onChange={(e) => {
							dispatch({
								payload: e.target.value as TournamentType,
								type: "SET_TOURNAMENT_TYPE",
							});
						}}
					>
						<option disabled selected>
							{t("Choose an area")}
						</option>
						{tournamentAreas.map((t) => (
							<option key={t.key} value={t.key}>
								{t.value}
							</option>
						))}
					</select>
				)}
			</div>
		</fieldset>
	);
};

const defaultFormValues: {
	title: string;
	shortTitle: string;
	startDate: Date;
	endDate: Date | null;
	location: string;
	status: AppointmentStatus;
} = {
	endDate: null,
	location: "",
	shortTitle: "",
	startDate: new Date(),
	status: AppointmentStatus.DRAFT,
	title: "",
};
const AppointmentEditSection = () => {
	const router = useRouter();

	const { state } = useCreateAppointmentContext();

	const createMutation = useMutation({
		fn: createAppointment,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400 && data.data) {
				await router.invalidate();
				notify({ status: "success", title: data.message });
				await router.navigate({
					params: { apptId: data.data.id },
					to: "/appts/$apptId",
				});
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	const form = useForm({
		defaultValues: defaultFormValues,
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					endDate: value.endDate,
					location: value.location,
					shortTitle: value.shortTitle,
					startDate: value.startDate,
					status: value.status,
					title: value.title,
					type:
						state.type === "holiday"
							? "HOLIDAY"
							: state.tournamentType === "bavaria"
								? "TOURNAMENT"
								: "TOURNAMENT_DE",
				},
			});
		},
	});

	if (!state.tournamentType) return null;

	return (
		<div>
			<form
				className="flex flex-col gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="title">
						{(field) => {
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Title")}:
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
				<div>
					<form.Field name="shortTitle">
						{(field) => {
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("ShortTitle")}:
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
				<div>
					<form.Field name="startDate">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("StartDate")}:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									type="datetime-local"
									name={field.name}
									value={
										field.state.value.getTime() > 0
											? dateToInputValue(field.state.value)
											: ""
									}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(new Date(e.target.value))}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field name="endDate">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("EndDate")}:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									type="date"
									name={field.name}
									value={
										field.state.value
											? dateToInputValue(field.state.value, false)
											: ""
									}
									onBlur={field.handleBlur}
									onChange={(e) => {
										if (e.target.value === "") {
											field.handleChange(null);
											return;
										}
										field.handleChange(new Date(e.target.value));
									}}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
				{state.type !== "holiday" && (
					<>
						<div>
							<form.Field name="location">
								{(field) => (
									<fieldset className="fieldset">
										<label className="label" htmlFor={field.name}>
											{t("Location")}:
										</label>
										<input
											id={field.name}
											className="input input-primary w-full"
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</fieldset>
								)}
							</form.Field>
						</div>
						<div>
							<form.Field name="status">
								{(field) => (
									<fieldset className="fieldset">
										<label className="label">
											{t("Publish")}?
											<input
												id={field.name}
												className="checkbox checkbox-primary"
												type="checkbox"
												checked={field.state.value !== AppointmentStatus.DRAFT}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) =>
													field.handleChange(
														e.target.checked
															? AppointmentStatus.PUBLISHED
															: AppointmentStatus.DRAFT,
													)
												}
											/>
										</label>
									</fieldset>
								)}
							</form.Field>
						</div>
					</>
				)}
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<button
							type="submit"
							className="btn btn-primary mt-4"
							disabled={!canSubmit}
						>
							{isSubmitting ? "..." : t("Create")}
						</button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

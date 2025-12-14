import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import React from "react";
import { create } from "zustand";
import { createAppointment } from "@/api/appointments";
import { useMutation } from "@/hooks/useMutation";
import { AppointmentStatus, AppointmentType } from "@/lib/prisma/enums";
import { dateToInputValue } from "@/lib/utils";
import { notify } from "./Toast";

const types = ["Tournament", "Holiday"] as const;
const tournamentAreas = ["Bavaria", "Germany"] as const;

type CreateState = {
	type: (typeof types)[number] | undefined;
	tournamentType: (typeof tournamentAreas)[number] | undefined;
};

type CreateActions = {
	setType: (type: (typeof types)[number]) => void;
	setTournamentType: (tournamentType: (typeof tournamentAreas)[number]) => void;
};

const useCreateState = create<CreateState & CreateActions>((set) => ({
	type: undefined,
	tournamentType: undefined,
	setType: (type: (typeof types)[number]) => set({ type }),
	setTournamentType: (tournamentType: (typeof tournamentAreas)[number]) =>
		set({ tournamentType }),
}));

export const CreateAppointmentForm = () => {
	const { type, tournamentType } = useCreateState();

	const appointmentType = React.useMemo(() => {
		if (type === "Holiday") {
			return AppointmentType.HOLIDAY;
		} else if (tournamentType === "Bavaria") {
			return AppointmentType.TOURNAMENT_BY;
		} else if (tournamentType === "Germany") {
			return AppointmentType.TOURNAMENT_DE;
		}
		return null;
	}, [tournamentType, type]);

	const renderEditSection = React.useCallback(() => {
		if (!appointmentType) return null;

		return <AppointmentEditSection appointmentType={appointmentType} />;
	}, [appointmentType]);

	return (
		<div>
			<AppointmentTypeSelect />
			<div className="divider"></div>
			{renderEditSection()}
		</div>
	);
};

const AppointmentTypeSelect = () => {
	const { type, setType, setTournamentType } = useCreateState();
	return (
		<fieldset className="fieldset">
			<legend className="fieldset-legend">Appointment type</legend>
			<div className="flex gap-2">
				<select
					className="select select-primary max-w-1/2"
					onChange={(e) => {
						setType(e.target.value as any);
					}}
				>
					<option disabled selected>
						Choose a type
					</option>
					{types.map((t) => (
						<option key={t}>{t}</option>
					))}
				</select>
				{type === "Tournament" && (
					<select
						className="select select-primary max-w-1/2"
						onChange={(e) => setTournamentType(e.target.value as any)}
					>
						<option disabled selected>
							Choose an area
						</option>
						{tournamentAreas.map((t) => (
							<option key={t}>{t}</option>
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
	endDate?: Date;
	location?: string;
	status: AppointmentStatus;
} = {
	title: "",
	shortTitle: "",
	location: "",
	startDate: new Date(),
	status: AppointmentStatus.DRAFT,
};
const AppointmentEditSection = ({
	appointmentType,
}: {
	appointmentType: AppointmentType;
}) => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createAppointment,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400 && data.data) {
				await router.invalidate();
				notify({ text: data.message, status: "success" });
				await router.navigate({
					to: "/appts/$apptId",
					params: { apptId: data.data.id },
				});
				return;
			}
			notify({ text: data.message, status: "error" });
		},
	});

	const form = useForm({
		defaultValues: defaultFormValues,
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					title: value.title,
					shortTitle: value.shortTitle,
					type: appointmentType,
					startDate: value.startDate,
					endDate: value.endDate,
					location: value.location,
					status: value.status,
				},
			});
		},
	});
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
										Title:
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
										Short Title:
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
									Start Date:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									type="datetime-local"
									name={field.name}
									value={dateToInputValue(field.state.value)}
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
									End Date:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									type="date"
									name={field.name}
									value={
										field.state.value &&
										dateToInputValue(field.state.value, false)
									}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(new Date(e.target.value))}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
				{appointmentType !== AppointmentType.HOLIDAY && (
					<>
						<div>
							<form.Field name="location">
								{(field) => (
									<fieldset className="fieldset">
										<label className="label" htmlFor={field.name}>
											Location:
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
											Publish?
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
							{isSubmitting ? "..." : "Create"}
						</button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

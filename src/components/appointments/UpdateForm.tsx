import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { updateAppointment } from "@/api/appointments";
import { useMutation } from "@/hooks/useMutation";
import type { Appointment } from "@/lib/prisma/client";
import { AppointmentStatus, AppointmentType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { dateToInputValue } from "@/lib/utils";
import { notify } from "../Toast";

type UpdateFormProps = {
	appointment: Appointment;
};

export const UpdateForm = ({ appointment }: UpdateFormProps) => {
	const router = useRouter();

	const updateMutation = useMutation({
		fn: updateAppointment,
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
		defaultValues: {
			title: appointment.title,
			shortTitle: appointment.shortTitle,
			startDate: new Date(appointment.startDate),
			endDate: appointment.endDate ? new Date(appointment.endDate) : null,
			location: appointment.location,
			status: appointment.status,
			link: appointment.link,
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutate({
				data: {
					id: appointment.id,
					updates: {
						title: value.title,
						startDate: value.startDate,
						endDate: value.endDate,
						location: value.location,
						status: value.status,
						link: value.link,
					},
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
											: undefined
									}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(new Date(e.target.value))}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
				{appointment.type !== AppointmentType.HOLIDAY && (
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
											value={field.state.value || undefined}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
									</fieldset>
								)}
							</form.Field>
						</div>
						<div>
							<form.Field name="link">
								{(field) => (
									<fieldset className="fieldset">
										<label className="label" htmlFor={field.name}>
											{t("Link")}:
										</label>
										<input
											id={field.name}
											className="input input-primary w-full"
											name={field.name}
											value={field.state.value || undefined}
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
							{isSubmitting ? "..." : t("Update")}
						</button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

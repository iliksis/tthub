import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { updateAppointment } from "@/api/appointments";
import { useMutation } from "@/hooks/useMutation";
import type { Appointment } from "@/lib/prisma/client";
import { AppointmentType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { dateToInputValue } from "@/lib/utils";

type UpdateFormProps = {
	appointment: Appointment;
	appointments: Appointment[];
};

export const UpdateForm = ({ appointment, appointments }: UpdateFormProps) => {
	const router = useRouter();

	const updateMutation = useMutation({
		fn: updateAppointment,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400 && data.data) {
				await router.invalidate();
				toast.success(data.message);
				await router.navigate({
					params: { apptId: data.data.id },
					to: "/appts/$apptId",
				});
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			endDate: appointment.endDate ? new Date(appointment.endDate) : null,
			link: appointment.link,
			location: appointment.location,
			nextAppointment: appointment.nextAppointmentId,
			shortTitle: appointment.shortTitle,
			startDate: new Date(appointment.startDate),
			status: appointment.status,
			title: appointment.title,
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutate({
				data: {
					id: appointment.id,
					updates: {
						endDate: value.endDate,
						link: value.link,
						location: value.location,
						nextAppointmentId: value.nextAppointment,
						shortTitle: value.shortTitle,
						startDate: value.startDate,
						status: value.status,
						title: value.title,
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
										field.state.value && field.state.value.getTime() > 0
											? dateToInputValue(field.state.value, false)
											: ""
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
							<form.Field name="nextAppointment">
								{(field) => (
									<fieldset className="fieldset">
										<label className="label" htmlFor={field.name}>
											{t("Next Appointment")}:
										</label>
										<select
											className="select select-primary w-full"
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										>
											<option disabled selected>
												{t("Choose an appointment")}
											</option>
											{appointments.map((p) => (
												<option
													key={p.id}
													value={p.id}
													disabled={p.id === appointment.id}
													className="before:content-[attr(data-before)] before:opacity-60"
													data-before={new Date(p.startDate).toLocaleDateString(
														"de-DE",
														{
															day: "2-digit",
															month: "2-digit",
															year: "2-digit",
														},
													)}
												>
													{p.title}
												</option>
											))}
										</select>
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

import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { createAppointment } from "@/api/appointments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
			<Separator className="my-4" />
			<AppointmentEditSection />
		</CreateAppointmentProvider>
	);
};

const AppointmentTypeSelect = () => {
	const { state, dispatch } = useCreateAppointmentContext();

	return (
		<fieldset className="flex flex-col gap-1.5">
			<legend className="fieldset-legend">{t("Appointment type")}</legend>
			<div className="flex gap-2">
				<Select
					onValueChange={(value) => {
						dispatch({
							payload: value as AppointmentType,
							type: "SET_TYPE",
						});
					}}
				>
					<SelectTrigger className="w-1/2">
						<SelectValue placeholder={t("Choose a type")} />
					</SelectTrigger>
					<SelectContent>
						{types.map((t) => (
							<SelectItem key={t.key} value={t.key}>
								{t.value}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{state.type === "tournament" && (
					<Select
						onValueChange={(value) => {
							dispatch({
								payload: value as TournamentType,
								type: "SET_TOURNAMENT_TYPE",
							});
						}}
					>
						<SelectTrigger className="w-1/2">
							<SelectValue placeholder={t("Choose an area")} />
						</SelectTrigger>
						<SelectContent>
							{tournamentAreas.map((t) => (
								<SelectItem key={t.key} value={t.key}>
									{t.value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</div>
		</fieldset>
	);
};

const getTodayAtTen = () => {
	const date = new Date();
	date.setHours(10, 0, 0, 0);
	return date;
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
	startDate: getTodayAtTen(),
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

	if (!state.type || (state.type === "tournament" && !state.tournamentType))
		return null;

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
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Title")}:</Label>
									<Input
										id={field.name}
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
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("ShortTitle")}:</Label>
									<Input
										id={field.name}
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
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("StartDate")}:</Label>
								<Input
									id={field.name}
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
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("EndDate")}:</Label>
								<Input
									id={field.name}
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
									<fieldset className="flex flex-col gap-1.5">
										<Label htmlFor={field.name}>{t("Location")}:</Label>
										<Input
											id={field.name}
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
									<fieldset className="flex flex-col gap-1.5">
										<div className="flex items-center gap-2">
											<Checkbox
												id={field.name}
												checked={field.state.value !== AppointmentStatus.DRAFT}
												name={field.name}
												onBlur={field.handleBlur}
												onCheckedChange={(checked) =>
													field.handleChange(
														checked === true
															? AppointmentStatus.PUBLISHED
															: AppointmentStatus.DRAFT,
													)
												}
											/>
											<Label htmlFor={field.name}>{t("Publish")}?</Label>
										</div>
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
						<Button type="submit" className="mt-4" disabled={!canSubmit}>
							{isSubmitting ? "..." : t("Create")}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

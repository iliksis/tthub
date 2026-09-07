import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { CalendarIcon, CheckIcon, TrophyIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { createAppointment } from "@/api/appointments";
import { LabelBadges } from "@/components/labels/LabelBadges";
import { LabelMultiSelect } from "@/components/labels/LabelMultiSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EntitySelect } from "@/components/ui/entity-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { Label as LabelRecord, Season } from "@/lib/prisma/client";
import { AppointmentStatus } from "@/lib/prisma/enums";
import { cn, dateToInputValue } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type AppointmentType = "holiday" | "tournament";

const getTodayAtTen = () => {
	const date = new Date();
	date.setHours(10, 0, 0, 0);
	return date;
};

type CreateAppointmentFormProps = {
	seasons: Season[];
	activeSeason: Season | null | undefined;
	labels: LabelRecord[];
};

export const CreateAppointmentForm = ({
	seasons,
	activeSeason,
	labels,
}: CreateAppointmentFormProps) => {
	const router = useRouter();
	const [step, setStep] = React.useState(0);
	const [type, setType] = React.useState<AppointmentType>();
	const [selectedLabels, setSelectedLabels] = React.useState<LabelRecord[]>([]);

	const defaultFormValues: {
		title: string;
		startDate: Date;
		endDate: Date | null;
		location: string;
		status: AppointmentStatus;
		seasonId: string;
	} = {
		endDate: null,
		location: "",
		seasonId: activeSeason?.id ?? seasons[0]?.id ?? "",
		startDate: getTodayAtTen(),
		status: AppointmentStatus.DRAFT,
		title: "",
	};

	const createMutation = useMutation({
		fn: createAppointment,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
			await router.navigate({
				params: { apptId: ctx.data.data.id },
				to: "/appts/$apptId",
			});
		},
	});

	const form = useForm({
		defaultValues: defaultFormValues,
		onSubmit: async ({ value }) => {
			if (type === "holiday") {
				createMutation.mutate({
					data: {
						endDate: value.endDate,
						startDate: value.startDate,
						title: value.title,
						type: "HOLIDAY",
					},
				});
				return;
			}
			createMutation.mutate({
				data: {
					endDate: value.endDate,
					labelIds: selectedLabels.map((l) => l.id),
					location: value.location,
					seasonId: value.seasonId,
					startDate: value.startDate,
					status: value.status,
					title: value.title,
					type: "TOURNAMENT",
				},
			});
		},
	});

	const steps = [
		m.appointments_type(),
		m.common_details(),
		m.appointments_review(),
	];
	const canAdvanceFromType = !!type;

	const typeStep = (
		<div className="duration-300 animate-in fade-in slide-in-from-right-2">
			<h2 className="mb-4 font-semibold text-base">
				{m.appointments_appointment_type()}
			</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<button
					type="button"
					onClick={() => setType("holiday")}
					className={cn(
						"flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors duration-150",
						type === "holiday"
							? "border-primary bg-primary/5"
							: "border-border/60 hover:bg-accent/50",
					)}
				>
					<div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<CalendarIcon className="size-5" />
					</div>
					<div>
						<div className="font-medium text-sm">{m.common_holiday()}</div>
						<div className="text-muted-foreground text-xs">
							{m.appointments_a_closed_period_without_training_or_events()}
						</div>
					</div>
				</button>
				<button
					type="button"
					disabled={seasons.length === 0}
					title={
						seasons.length === 0 ? m.common_create_a_season_first() : undefined
					}
					onClick={() => setType("tournament")}
					className={cn(
						"flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
						type === "tournament"
							? "border-primary bg-primary/5"
							: "border-border/60 hover:bg-accent/50",
					)}
				>
					<div className="flex size-11 items-center justify-center rounded-lg bg-success text-success-foreground">
						<TrophyIcon className="size-5" />
					</div>
					<div>
						<div className="font-medium text-sm">{m.common_tournament()}</div>
						<div className="text-muted-foreground text-xs">
							{m.appointments_a_competitive_event_players_sign_up_for()}
						</div>
					</div>
				</button>
			</div>

			<Button
				className="mt-6"
				disabled={!canAdvanceFromType}
				onClick={() => setStep(1)}
			>
				{m.appointments_continue()}
			</Button>
		</div>
	);

	const detailsStep = (
		<div className="duration-300 animate-in fade-in slide-in-from-right-2">
			<h2 className="mb-4 font-semibold text-base">{m.common_details()}</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<form.Field name="title">
					{(field) => (
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor={field.name}>{m.common_title()}:</Label>
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
				<form.Field name="startDate">
					{(field) => (
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor={field.name}>{m.appointments_startdate()}:</Label>
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
				<form.Field name="endDate">
					{(field) => (
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor={field.name}>{m.appointments_enddate()}:</Label>
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
				{type !== "holiday" && (
					<form.Field name="location">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{m.appointments_location()}:</Label>
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
				)}
				{type !== "holiday" && (
					<form.Field name="seasonId">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{m.common_season()}:</Label>
								<EntitySelect
									id={field.name}
									items={seasons}
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value ?? "")}
								/>
							</fieldset>
						)}
					</form.Field>
				)}
				{type === "tournament" && (
					<fieldset className="flex flex-col gap-1.5 sm:col-span-2">
						<Label>{m.labels_labels()}:</Label>
						<LabelMultiSelect
							availableLabels={labels}
							selectedIds={selectedLabels.map((l) => l.id)}
							onChange={setSelectedLabels}
						/>
					</fieldset>
				)}
			</div>
			<div className="mt-6 flex justify-between">
				<Button variant="outline" onClick={() => setStep(0)}>
					{m.appointments_back()}
				</Button>
				<form.Subscribe
					selector={(state) => [state.values.title, state.values.seasonId]}
				>
					{([title, seasonId]) => (
						<Button
							disabled={!title || (type !== "holiday" && !seasonId)}
							onClick={() => setStep(2)}
						>
							{m.appointments_continue()}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</div>
	);

	const reviewStep = (
		<form
			className="duration-300 animate-in fade-in slide-in-from-right-2"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h2 className="mb-4 font-semibold text-base">
				{m.appointments_review()}
			</h2>
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border/60 bg-card p-5 sm:grid-cols-2">
						<div className="sm:col-span-2 flex items-center gap-2">
							{type === "holiday" ? (
								<CalendarIcon className="size-4 text-primary" />
							) : (
								<TrophyIcon className="size-4 text-success" />
							)}
							<span className="font-medium text-sm">
								{values.title || m.appointments_untitled()}
							</span>
						</div>
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								{m.appointments_startdate()}
							</div>
							<div className="text-sm">
								{values.startDate.toLocaleString("de-DE")}
							</div>
						</div>
						{type !== "holiday" && (
							<div>
								<div className="text-muted-foreground text-xs uppercase">
									{m.appointments_location()}
								</div>
								<div className="text-sm">{values.location || "—"}</div>
							</div>
						)}
						{type === "tournament" && selectedLabels.length > 0 && (
							<div className="sm:col-span-2">
								<div className="text-muted-foreground text-xs uppercase">
									{m.labels_labels()}
								</div>
								<LabelBadges labels={selectedLabels} className="mt-1" />
							</div>
						)}
					</div>
				)}
			</form.Subscribe>
			{type !== "holiday" && (
				<form.Field name="status">
					{(field) => (
						<fieldset className="mb-6 flex flex-col gap-1.5">
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
								<Label htmlFor={field.name}>{m.appointments_publish()}?</Label>
							</div>
						</fieldset>
					)}
				</form.Field>
			)}
			<div className="flex justify-between">
				<Button type="button" variant="outline" onClick={() => setStep(1)}>
					{m.appointments_back()}
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? m.common_loading() : m.common_create()}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);

	const stepContent = [typeStep, detailsStep, reviewStep][step];

	return (
		<div className="lg:flex">
			{/* Mobile: compact step progress above the content */}
			<div className="border-border/60 border-b pb-4 lg:hidden">
				<h1 className="mb-3 font-bold text-lg">
					{m.appointments_create_appointment()}
				</h1>
				<div className="flex items-center gap-2">
					{steps.map((label, i) => (
						<React.Fragment key={label}>
							<div className="flex items-center gap-1.5">
								<div
									className={cn(
										"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
										i < step
											? "bg-success text-success-foreground"
											: i === step
												? "bg-primary text-primary-foreground"
												: "bg-muted text-muted-foreground",
									)}
								>
									{i < step ? <CheckIcon className="size-3" /> : i + 1}
								</div>
								<span
									className={cn(
										"text-xs font-medium",
										i === step ? "text-foreground" : "text-muted-foreground",
									)}
								>
									{label}
								</span>
							</div>
							{i < steps.length - 1 && (
								<div className="h-px flex-1 bg-border/60" />
							)}
						</React.Fragment>
					))}
				</div>
			</div>

			{/* Desktop: persistent left step rail */}
			<div className="hidden w-56 shrink-0 border-border/60 border-r pr-6 lg:block">
				<h1 className="mb-6 font-bold text-lg">
					{m.appointments_create_appointment()}
				</h1>
				<div className="flex flex-col gap-1">
					{steps.map((label, i) => (
						<button
							key={label}
							type="button"
							disabled={i > step && !(i === step + 1 && canAdvanceFromType)}
							onClick={() => {
								if (i <= step || (i === step + 1 && canAdvanceFromType))
									setStep(i);
							}}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150",
								i === step
									? "bg-primary/10 font-medium text-primary"
									: "text-muted-foreground hover:bg-accent/50 disabled:hover:bg-transparent",
							)}
						>
							<div
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
									i < step
										? "bg-success text-success-foreground"
										: i === step
											? "bg-primary text-primary-foreground"
											: "bg-muted text-muted-foreground",
								)}
							>
								{i < step ? <CheckIcon className="size-3" /> : i + 1}
							</div>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className="flex-1 pt-4 lg:pl-8">{stepContent}</div>
		</div>
	);
};

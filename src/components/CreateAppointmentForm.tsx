import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { CalendarIcon, CheckIcon, TrophyIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { createAppointment } from "@/api/appointments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import { AppointmentStatus } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, dateToInputValue } from "@/lib/utils";

type AppointmentType = "holiday" | "tournament";
type TournamentType = "bavaria" | "germany";

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

export const CreateAppointmentForm = () => {
	const router = useRouter();
	const [step, setStep] = React.useState(0);
	const [type, setType] = React.useState<AppointmentType>();
	const [tournamentType, setTournamentType] = React.useState<TournamentType>();

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
						type === "holiday"
							? "HOLIDAY"
							: tournamentType === "bavaria"
								? "TOURNAMENT"
								: "TOURNAMENT_DE",
				},
			});
		},
	});

	const steps = [t("Type"), t("Details"), t("Review")];
	const canAdvanceFromType = type === "tournament" ? !!tournamentType : !!type;

	const typeStep = (
		<div className="duration-300 animate-in fade-in slide-in-from-right-2">
			<h2 className="mb-4 font-semibold text-base">{t("Appointment type")}</h2>
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
					<div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
						<CalendarIcon className="size-5" />
					</div>
					<div>
						<div className="font-medium text-sm">{t("Holiday")}</div>
						<div className="text-muted-foreground text-xs">
							{t("A closed period without training or events")}
						</div>
					</div>
				</button>
				<button
					type="button"
					onClick={() => setType("tournament")}
					className={cn(
						"flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors duration-150",
						type === "tournament"
							? "border-primary bg-primary/5"
							: "border-border/60 hover:bg-accent/50",
					)}
				>
					<div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-success to-success/70 text-success-foreground">
						<TrophyIcon className="size-5" />
					</div>
					<div>
						<div className="font-medium text-sm">{t("Tournament")}</div>
						<div className="text-muted-foreground text-xs">
							{t("A competitive event players sign up for")}
						</div>
					</div>
				</button>
			</div>

			{type === "tournament" && (
				<div className="mt-4 grid grid-cols-1 gap-4 duration-200 animate-in fade-in slide-in-from-top-1 sm:grid-cols-2">
					<button
						type="button"
						onClick={() => setTournamentType("bavaria")}
						className={cn(
							"rounded-lg border px-4 py-2.5 text-left text-sm transition-colors duration-150",
							tournamentType === "bavaria"
								? "border-success bg-success/10 font-medium"
								: "border-border/60 hover:bg-accent/50",
						)}
					>
						{t("Bavaria")}
					</button>
					<button
						type="button"
						onClick={() => setTournamentType("germany")}
						className={cn(
							"rounded-lg border px-4 py-2.5 text-left text-sm transition-colors duration-150",
							tournamentType === "germany"
								? "border-info bg-info/10 font-medium"
								: "border-border/60 hover:bg-accent/50",
						)}
					>
						{t("Germany")}
					</button>
				</div>
			)}

			<Button
				className="mt-6"
				disabled={!canAdvanceFromType}
				onClick={() => setStep(1)}
			>
				{t("Continue")}
			</Button>
		</div>
	);

	const detailsStep = (
		<div className="duration-300 animate-in fade-in slide-in-from-right-2">
			<h2 className="mb-4 font-semibold text-base">{t("Details")}</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<form.Field name="title">
					{(field) => (
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
					)}
				</form.Field>
				<form.Field name="shortTitle">
					{(field) => (
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
					)}
				</form.Field>
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
				{type !== "holiday" && (
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
				)}
			</div>
			<div className="mt-6 flex justify-between">
				<Button variant="outline" onClick={() => setStep(0)}>
					{t("Back")}
				</Button>
				<form.Subscribe selector={(state) => [state.values.title]}>
					{([title]) => (
						<Button disabled={!title} onClick={() => setStep(2)}>
							{t("Continue")}
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
			<h2 className="mb-4 font-semibold text-base">{t("Review")}</h2>
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
								{values.title || t("Untitled")}
							</span>
						</div>
						<div>
							<div className="text-muted-foreground text-xs uppercase">
								{t("StartDate")}
							</div>
							<div className="text-sm">
								{values.startDate.toLocaleString("de-DE")}
							</div>
						</div>
						{type !== "holiday" && (
							<div>
								<div className="text-muted-foreground text-xs uppercase">
									{t("Location")}
								</div>
								<div className="text-sm">{values.location || "—"}</div>
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
								<Label htmlFor={field.name}>{t("Publish")}?</Label>
							</div>
						</fieldset>
					)}
				</form.Field>
			)}
			<div className="flex justify-between">
				<Button type="button" variant="outline" onClick={() => setStep(1)}>
					{t("Back")}
				</Button>
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? "..." : t("Create")}
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
				<h1 className="mb-3 font-bold text-lg">{t("Create appointment")}</h1>
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
				<h1 className="mb-6 font-bold text-lg">{t("Create appointment")}</h1>
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

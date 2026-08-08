import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { toast } from "sonner";
import { importHolidays } from "@/api/appointments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";

const validator = (value: { startDate: string; endDate: string }) => {
	if (value.startDate === "") {
		return "Start date must be defined";
	}
	if (value.endDate === "") {
		return "End date must be defined";
	}
	if (value.startDate > value.endDate) {
		return "Start date must be before end date";
	}
	return undefined;
};

type HolidayImportProps = {
	countries: { title: string; code: string }[];
};
export const HolidayImport = ({ countries }: HolidayImportProps) => {
	const router = useRouter();

	const importMutation = useMutation({
		fn: importHolidays,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			country: "DE",
			endDate: "",
			startDate: "",
			subdivision: "",
		},
		onSubmit: async ({ value }) => {
			await importMutation.mutate({
				data: {
					country: value.country,
					endDate: value.endDate,
					startDate: value.startDate,
					subdivision: value.subdivision,
				},
			});
		},
		validators: {
			onSubmit: ({ value }) => validator(value),
		},
	});

	const formErrorMap = useStore(form.store, (state) => state.errorMap);

	const countrySelect = useStore(form.store, (state) => state.values.country);

	const query = useQuery({
		enabled: !!countrySelect,
		queryFn: async () => {
			const api = new Holiday();
			return await api.getSubdivisions(countrySelect);
		},
		queryKey: ["subdivisions", countrySelect],
	});

	return (
		<div>
			<h1>{t("Import Holidays")}</h1>
			<form className="mt-2 flex flex-col gap-2">
				<div className="flex gap-2">
					<form.Field name="country">
						{(field) => {
							return (
								<fieldset className="flex flex-1 flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Country")}:</Label>
									<Select
										name={field.name}
										value={field.state.value || undefined}
										onValueChange={(value) => {
											form.setFieldValue("subdivision", "");
											field.handleChange(value ?? "");
										}}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{countries.map((c) => (
												<SelectItem key={c.code} value={c.code}>
													{c.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							);
						}}
					</form.Field>
					<form.Field name="subdivision">
						{(field) => {
							return (
								<fieldset className="flex flex-1 flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Subdivision")}:</Label>
									<Select
										name={field.name}
										disabled={!query.data || query.data.length === 0}
										value={field.state.value || undefined}
										onValueChange={(value) => field.handleChange(value ?? "")}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{query.data?.map((c) => (
												<SelectItem key={c.code} value={c.code}>
													{c.name[0].text}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
				<div className="flex gap-2">
					<form.Field name="startDate">
						{(field) => {
							return (
								<fieldset className="flex flex-1 flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Start")}:</Label>
									<Input
										id={field.name}
										type="date"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
					<form.Field name="endDate">
						{(field) => {
							return (
								<fieldset className="flex flex-1 flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("End")}:</Label>
									<Input
										id={field.name}
										type="date"
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
				{formErrorMap.onSubmit && (
					<Alert variant="destructive">
						<AlertDescription>{formErrorMap.onSubmit}</AlertDescription>
					</Alert>
				)}
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<Button
							type="button"
							disabled={!canSubmit}
							onClick={form.handleSubmit}
						>
							{isSubmitting ? t("Loading…") : t("Import")}
						</Button>
					)}
				</form.Subscribe>
			</form>
			<div>{}</div>
		</div>
	);
};

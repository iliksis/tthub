import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Holiday } from "open-holiday-js";
import { importHolidays } from "@/api/appointments";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { notify } from "../Toast";

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
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({ text: data.message, status: "success" });
				return;
			}
			notify({ text: data.message, status: "error" });
		},
	});

	const form = useForm({
		defaultValues: {
			country: "DE",
			subdivision: "",
			startDate: "",
			endDate: "",
		},
		onSubmit: async ({ value }) => {
			await importMutation.mutate({
				data: {
					subdivision: value.subdivision,
					country: value.country,
					startDate: value.startDate,
					endDate: value.endDate,
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
		queryKey: ["subdivisions", countrySelect],
		queryFn: async () => {
			const api = new Holiday();
			return await api.getSubdivisions(countrySelect);
		},
		enabled: !!countrySelect,
	});

	return (
		<div>
			<h1>{t("Import Holidays")}</h1>
			<form className="mt-2 flex flex-col gap-2">
				<div className="flex gap-2">
					<form.Field name="country">
						{(field) => {
							return (
								<fieldset className="fieldset flex-1">
									<label className="label" htmlFor={field.name}>
										{t("Country")}:
									</label>
									<select
										id={field.name}
										className="select select-primary"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => {
											form.setFieldValue("subdivision", "");
											field.handleChange(e.target.value);
										}}
									>
										{countries.map((c) => (
											<option key={c.code} value={c.code}>
												{c.title}
											</option>
										))}
									</select>
								</fieldset>
							);
						}}
					</form.Field>
					<form.Field name="subdivision">
						{(field) => {
							return (
								<fieldset className="fieldset flex-1">
									<label className="label" htmlFor={field.name}>
										{t("Subdivision")}:
									</label>
									<select
										id={field.name}
										className="select select-primary"
										name={field.name}
										disabled={!query.data || query.data.length === 0}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									>
										{query.data?.map((c) => (
											<option key={c.code} value={c.code}>
												{c.name[0].text}
											</option>
										))}
									</select>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
				<div className="flex gap-2">
					<form.Field name="startDate">
						{(field) => {
							return (
								<fieldset className="fieldset flex-1">
									<label className="label" htmlFor={field.name}>
										{t("Start")}:
									</label>
									<input
										id={field.name}
										className="input input-primary"
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
								<fieldset className="fieldset flex-1">
									<label className="label" htmlFor={field.name}>
										{t("End")}:
									</label>
									<input
										id={field.name}
										className="input input-primary"
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
					<div role="alert" className="alert alert-error alert-soft">
						{formErrorMap.onSubmit}
					</div>
				)}
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<button
							type="button"
							className="btn btn-primary"
							disabled={!canSubmit}
							onClick={form.handleSubmit}
						>
							{isSubmitting ? "..." : t("Import")}
						</button>
					)}
				</form.Subscribe>
			</form>
			<div>{}</div>
		</div>
	);
};

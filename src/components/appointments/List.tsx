import { useForm } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { FilterIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
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
import { TableRow } from "@/components/ui/table";
import type { Appointment, Response } from "@/lib/prisma/client";
import { AppointmentType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";
import { DetailsList, type DetailsListColumn } from "../DetailsList";
import { Modal } from "../modal/Modal";

type ListProps = {
	appointments: (Appointment & { responses: Response[] })[];
};

const getUserResponse = (
	item: Appointment & { responses: Response[] },
	userId: string | undefined,
) => item.responses?.find((r) => r.userId === userId)?.responseType ?? "MAYBE";

export const getAppointmentColumns = (
	userId: string | undefined,
	{ includeResponseColumn = false, sortable = true } = {},
): DetailsListColumn<Appointment & { responses: Response[] }>[] => [
	// The response column already conveys status, so the leading dot is only
	// needed when that column isn't present (the mobile list).
	...(includeResponseColumn
		? []
		: [
				{
					key: "status",
					label: "",
					render: (item: Appointment & { responses: Response[] }) => {
						const userResponse = getUserResponse(item, userId);
						const isAccepted = userResponse === "ACCEPT";
						const isDeclined = userResponse === "DECLINE";
						return isAccepted ? (
							<div className="size-2 rounded-full bg-success" />
						) : isDeclined ? (
							<div className="size-2 rounded-full bg-destructive" />
						) : null;
					},
				},
			]),
	{
		key: "title",
		label: t("Title"),
		render: (item) => item.shortTitle,
		sortable,
		sortFn: (a, b) => a.shortTitle.localeCompare(b.shortTitle),
	},
	{
		key: "date",
		label: t("Date"),
		render: (item) => {
			const isMultipleDays =
				item.endDate !== null
					? new Date(item.startDate).getDate() !==
						new Date(item.endDate).getDate()
					: false;

			return (
				<>
					{new Date(item.startDate).toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					})}{" "}
					{isMultipleDays && item.endDate && (
						<>
							{" "}
							-{" "}
							{new Date(item.endDate).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}
						</>
					)}
				</>
			);
		},
		sortable,
		sortFn: (a, b) =>
			new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	},
	{
		key: "location",
		label: t("Location"),
		render: (item) => item.location,
	},
	...(includeResponseColumn
		? [
				{
					align: "right" as const,
					key: "response",
					label: "",
					render: (item: Appointment & { responses: Response[] }) => {
						if (item.type === AppointmentType.HOLIDAY) return null;
						const userResponse = getUserResponse(item, userId);
						const isAccepted = userResponse === "ACCEPT";
						const isDeclined = userResponse === "DECLINE";
						return (
							<Badge
								variant={
									isAccepted
										? "success"
										: isDeclined
											? "destructive"
											: "warning"
								}
							>
								{isAccepted
									? t("Accepted")
									: isDeclined
										? t("Declined")
										: t("Maybe")}
							</Badge>
						);
					},
				},
			]
		: []),
];

export const List = ({ appointments }: ListProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();

	const onClickAppointment = (id: string) => async () => {
		await router.navigate({ params: { apptId: id }, to: "/appts/$apptId" });
	};

	return (
		<div className="overflow-x-auto">
			<DetailsList
				items={appointments}
				getItemId={(item) => item.id}
				columns={getAppointmentColumns(user?.id)}
				onRenderRow={(item, children) => {
					const inPast = isDayInPast(item.startDate);
					const isDeleted = item.deletedAt !== null;
					return (
						<TableRow
							key={item.id}
							className={cn(
								"h-10 cursor-pointer",
								inPast && "opacity-65",
								isDeleted && "text-destructive",
							)}
							onClick={onClickAppointment(item.id)}
						>
							{children}
						</TableRow>
					);
				}}
				selectMode="none"
			/>
		</div>
	);
};

export const filterSchema = z.object({
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	deleted: z.boolean().optional(),
	query: z.string().optional(),
	response: z.enum(["ACCEPT", "MAYBE", "DECLINE", "NONE"]).optional(),
	skip: z.number().int().nonnegative().optional(),
	type: z.enum(["TOURNAMENT", "TOURNAMENT_DE", "HOLIDAY"]).optional(),
});
type FiltersProps = z.infer<typeof filterSchema>;

const typeOptions: { value: string; label: string }[] = [
	{ label: t("All types"), value: "ALL" },
	{ label: t("Tournament"), value: AppointmentType.TOURNAMENT },
	{ label: t("Tournament (Germany)"), value: AppointmentType.TOURNAMENT_DE },
	{ label: t("Holiday"), value: AppointmentType.HOLIDAY },
];

const responseOptions: { value: string; label: string }[] = [
	{ label: t("All responses"), value: "ALL" },
	{ label: t("Accepted"), value: "ACCEPT" },
	{ label: t("Maybe"), value: "MAYBE" },
	{ label: t("Declined"), value: "DECLINE" },
	{ label: t("No response"), value: "NONE" },
];

const useAppointmentFilterForm = ({
	dateFrom = "",
	dateTo = "",
	deleted = false,
	query = "",
	response,
	type,
}: FiltersProps) => {
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			dateFrom,
			dateTo,
			deleted,
			query,
			response: response ?? "ALL",
			type: type ?? "ALL",
		},
		onSubmit: async ({ value }) => {
			await router.navigate({
				replace: true,
				search: {
					dateFrom: value.dateFrom || undefined,
					dateTo: value.dateTo || undefined,
					deleted: value.deleted,
					query: value.query || undefined,
					response:
						value.response === "ALL"
							? undefined
							: (value.response as FiltersProps["response"]),
					type:
						value.type === "ALL"
							? undefined
							: (value.type as FiltersProps["type"]),
				},
				to: ".",
			});
		},
	});

	const onClear = () => {
		form.update({
			defaultValues: {
				dateFrom: "",
				dateTo: "",
				deleted: false,
				query: "",
				response: "ALL",
				type: "ALL",
			},
		});
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return { form, onClear };
};

// Unlike the mobile modal (which batches edits behind an explicit Apply),
// this bar applies every change immediately — text search is debounced so
// typing doesn't fire a navigation per keystroke, everything else (selects,
// dates, the checkbox) navigates on change.
export const InlineFilters = (props: FiltersProps) => {
	const router = useRouter();
	const [queryInput, setQueryInput] = React.useState(props.query ?? "");

	const navigate = React.useCallback(
		(next: Partial<FiltersProps>) => {
			router.navigate({
				replace: true,
				search: { ...props, ...next, skip: undefined },
				to: ".",
			});
		},
		[router, props],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-runs when the local input changes; navigate/props.query are read, not resynced on
	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (queryInput !== (props.query ?? "")) {
				navigate({ query: queryInput || undefined });
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const hasActiveFilters =
		!!props.query ||
		!!props.type ||
		!!props.response ||
		!!props.dateFrom ||
		!!props.dateTo ||
		!!props.deleted;

	const onClear = () => {
		setQueryInput("");
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Input
				className="w-56"
				placeholder={t("Search appointment or person...")}
				value={queryInput}
				onChange={(e) => setQueryInput(e.target.value)}
			/>
			<Select
				value={props.type ?? "ALL"}
				onValueChange={(v) =>
					navigate({
						type: v === "ALL" ? undefined : (v as FiltersProps["type"]),
					})
				}
			>
				<SelectTrigger size="sm" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{typeOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={props.response ?? "ALL"}
				onValueChange={(v) =>
					navigate({
						response: v === "ALL" ? undefined : (v as FiltersProps["response"]),
					})
				}
			>
				<SelectTrigger size="sm" className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{responseOptions.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<div className="flex items-center gap-2">
				<Label className="text-muted-foreground text-xs">{t("From")}</Label>
				<Input
					type="date"
					className="w-36"
					value={props.dateFrom ?? ""}
					onChange={(e) => navigate({ dateFrom: e.target.value || undefined })}
				/>
				<Label className="text-muted-foreground text-xs">{t("To")}</Label>
				<Input
					type="date"
					className="w-36"
					value={props.dateTo ?? ""}
					onChange={(e) => navigate({ dateTo: e.target.value || undefined })}
				/>
			</div>
			<label
				htmlFor="inline-filters-deleted"
				className="flex items-center gap-2 text-sm text-muted-foreground"
			>
				<Checkbox
					id="inline-filters-deleted"
					checked={props.deleted ?? false}
					onCheckedChange={(checked) =>
						navigate({ deleted: checked === true ? true : undefined })
					}
				/>
				{t("Show deleted?")}
			</label>
			{hasActiveFilters && (
				<Button type="button" size="sm" variant="secondary" onClick={onClear}>
					{t("Clear")}
				</Button>
			)}
		</div>
	);
};

export const Filters = (props: FiltersProps) => {
	const { form, onClear } = useAppointmentFilterForm(props);

	const [modal, setModal] = React.useState(false);

	const onRenderActionButton = () => {
		return (
			<>
				<Button
					type="submit"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{t("Apply")}
				</Button>
				<Button type="button" variant="secondary" onClick={onClear}>
					{t("Clear")}
				</Button>
			</>
		);
	};

	return (
		<>
			<Button
				className="fab lg:hidden"
				variant="secondary"
				size="icon-lg"
				type="button"
				onClick={() => setModal(true)}
			>
				<FilterIcon className="size-4" />
			</Button>
			<Modal
				modalBoxClassName="md:max-w-xl md:mx-auto"
				open={modal}
				onClose={() => setModal(false)}
				onRenderActionButton={onRenderActionButton}
			>
				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<h2>{t("Filters")}</h2>
					<div>
						<form.Field name="query">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>
										{t("Search appointment or person...")}
									</Label>
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
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="type">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Appointment type")}</Label>
									<Select
										value={field.state.value}
										onValueChange={(v) => field.handleChange(v)}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{typeOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							)}
						</form.Field>
						<form.Field name="response">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Response")}</Label>
									<Select
										value={field.state.value}
										onValueChange={(v) => field.handleChange(v)}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{responseOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<form.Field name="dateFrom">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("From")}</Label>
									<Input
										id={field.name}
										name={field.name}
										type="date"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
						<form.Field name="dateTo">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("To")}</Label>
									<Input
										id={field.name}
										name={field.name}
										type="date"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div>
						<form.Field name="deleted">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<div className="flex items-center gap-2">
										<Checkbox
											id={field.name}
											checked={field.state.value}
											name={field.name}
											onBlur={field.handleBlur}
											onCheckedChange={(checked) =>
												field.handleChange(checked === true)
											}
										/>
										<Label htmlFor={field.name}>{t("Show deleted?")}</Label>
									</div>
								</fieldset>
							)}
						</form.Field>
					</div>
				</form>
			</Modal>
		</>
	);
};

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
	deleted: z.boolean().optional(),
	location: z.string().optional(),
	title: z.string().optional(),
});
type FiltersProps = z.infer<typeof filterSchema>;

const useAppointmentFilterForm = ({
	deleted = false,
	title = "",
	location = "",
}: FiltersProps) => {
	const router = useRouter();

	const form = useForm({
		defaultValues: {
			deleted,
			location,
			title,
		},
		onSubmit: async ({ value }) => {
			await router.navigate({
				replace: true,
				search: { ...value },
				to: ".",
			});
		},
	});

	const onClear = () => {
		form.update({
			defaultValues: {
				deleted: false,
				location: "",
				title: "",
			},
		});
		router.navigate({ replace: true, search: {}, to: "." });
	};

	return { form, onClear };
};

export const InlineFilters = (props: FiltersProps) => {
	const { form, onClear } = useAppointmentFilterForm(props);

	return (
		<form
			className="flex flex-wrap items-center gap-3"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="title">
				{(field) => (
					<Input
						className="w-56"
						placeholder={t("Title")}
						id={field.name}
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
					/>
				)}
			</form.Field>
			<form.Field name="location">
				{(field) => (
					<Input
						className="w-48"
						placeholder={t("Location")}
						id={field.name}
						name={field.name}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
					/>
				)}
			</form.Field>
			<form.Field name="deleted">
				{(field) => (
					<label
						htmlFor={field.name}
						className="flex items-center gap-2 text-sm text-muted-foreground"
					>
						<Checkbox
							id={field.name}
							checked={field.state.value}
							name={field.name}
							onBlur={field.handleBlur}
							onCheckedChange={(checked) =>
								field.handleChange(checked === true)
							}
						/>
						{t("Show deleted?")}
					</label>
				)}
			</form.Field>
			<Button
				type="submit"
				size="sm"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				{t("Apply")}
			</Button>
			<Button type="button" size="sm" variant="secondary" onClick={onClear}>
				{t("Clear")}
			</Button>
		</form>
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
					className="flex flex-col gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<h2>{t("Filters")}</h2>
					<div>
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
					</div>
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

import { useForm } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { FilterIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import type { Appointment, Response } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";
import { DetailsList } from "../DetailsList";
import { Modal } from "../modal/Modal";

type ListProps = {
	appointments: (Appointment & { responses: Response[] })[];
};

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
				columns={[
					{
						key: "status",
						label: "",
						render: (item) => {
							const userResponse =
								item.responses?.find((r) => r.userId === user?.id)
									?.responseType ?? "MAYBE";
							const isAccepted = userResponse === "ACCEPT";
							const isDeclined = userResponse === "DECLINE";
							return isAccepted ? (
								<div className="status status-success"></div>
							) : isDeclined ? (
								<div className="status status-error"></div>
							) : null;
						},
					},
					{
						key: "title",
						label: t("Title"),
						render: (item) => item.shortTitle,
						sortable: true,
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
						sortable: true,
						sortFn: (a, b) =>
							new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
					},
					{
						key: "location",
						label: t("Location"),
						render: (item) => item.location,
					},
				]}
				onRenderRow={(item, children) => {
					const inPast = isDayInPast(item.startDate);
					const isDeleted = item.deletedAt !== null;
					return (
						<tr
							key={item.id}
							className={cn(
								"hover:bg-base-200 hover:cursor-pointer h-10",
								inPast && "opacity-65",
								isDeleted && "text-error",
							)}
							onClick={onClickAppointment(item.id)}
						>
							{children}
						</tr>
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
export const Filters = ({
	deleted = false,
	title = "",
	location = "",
}: FiltersProps) => {
	const router = useRouter();

	const [modal, setModal] = React.useState(false);

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

	const onRenderActionButton = () => {
		return (
			<>
				<button
					type="submit"
					className="btn btn-primary"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{t("Apply")}
				</button>
				<button
					type="button"
					className="btn btn-accent"
					onClick={() => {
						form.update({
							defaultValues: {
								deleted: false,
								location: "",
								title: "",
							},
						});
						router.navigate({ replace: true, search: {}, to: "." });
					}}
				>
					{t("Clear")}
				</button>
			</>
		);
	};

	return (
		<>
			<button
				className="fab btn btn-lg btn-circle"
				type="button"
				onClick={() => setModal(true)}
			>
				<FilterIcon className="size-4" />
			</button>
			<Modal
				className="modal-bottom"
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
							)}
						</form.Field>
					</div>
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
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										<input
											id={field.name}
											className="checkbox checkbox-primary"
											type="checkbox"
											checked={field.state.value}
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.checked)}
										/>
										{t("Show deleted?")}
									</label>
								</fieldset>
							)}
						</form.Field>
					</div>
				</form>
			</Modal>
		</>
	);
};

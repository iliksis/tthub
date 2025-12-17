import { useForm } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { FilterIcon } from "lucide-react";
import React from "react";
import { z } from "zod";
import type { Appointment, Response } from "@/lib/prisma/client";
import { cn, isDayInPast } from "@/lib/utils";
import { Modal } from "../modal/Modal";

type ListProps = {
	appointments: (Appointment & { responses: Response[] })[];
};

export const List = ({ appointments }: ListProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();

	const onClickAppointment = (id: string) => async () => {
		await router.navigate({ to: "/appts/$apptId", params: { apptId: id } });
	};

	const renderRow = (appointment: ListProps["appointments"][number]) => {
		const isMultipleDays =
			appointment.endDate !== null
				? new Date(appointment.startDate).getDate() !==
					new Date(appointment.endDate).getDate()
				: false;
		const inPast = isDayInPast(appointment.startDate);
		const isDeleted = appointment.deletedAt !== null;

		const userResponse =
			appointment.responses?.find((r) => r.userId === user?.id)?.responseType ??
			"MAYBE";
		const isAccepted = userResponse === "ACCEPT";
		const isDeclined = userResponse === "DECLINE";

		return (
			<tr
				key={appointment.id}
				className={cn(
					"hover:bg-base-200 hover:cursor-pointer",
					inPast && "opacity-65",
					isDeleted && "text-error",
				)}
				onClick={onClickAppointment(appointment.id)}
			>
				<td className="p-0 pl-1">
					{isAccepted ? (
						<div className="status status-success"></div>
					) : isDeclined ? (
						<div className="status status-error"></div>
					) : null}
				</td>
				<td>{appointment.shortTitle}</td>
				<td>
					{new Date(appointment.startDate).toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					})}{" "}
					{isMultipleDays && appointment.endDate && (
						<>
							{" "}
							-{" "}
							{new Date(appointment.endDate).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "2-digit",
								year: "2-digit",
							})}{" "}
						</>
					)}
				</td>
				<td>{appointment.location}</td>
			</tr>
		);
	};

	return (
		<div className="overflow-x-auto">
			{appointments.length > 0 ? (
				<table className="table text-xs">
					<thead className="text-xs">
						<tr>
							<th className="p-0"></th>
							<th>Title</th>
							<th>Date</th>
							<th>Location</th>
						</tr>
					</thead>
					<tbody>{appointments.map(renderRow)}</tbody>
				</table>
			) : (
				<div>No appointments found</div>
			)}
		</div>
	);
};

export const filterSchema = z.object({
	deleted: z.boolean().optional(),
	title: z.string().optional(),
	location: z.string().optional(),
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
			title,
			location,
		},
		onSubmit: async ({ value }) => {
			await router.navigate({
				to: ".",
				search: { ...value },
				replace: true,
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
					Apply
				</button>
				<button
					type="button"
					className="btn btn-accent"
					onClick={() => {
						form.update({
							defaultValues: {
								deleted: false,
								title: "",
								location: "",
							},
						});
						router.navigate({ to: ".", search: {}, replace: true });
					}}
				>
					Clear
				</button>
			</>
		);
	};

	return (
		<>
			<button
				className="fab btn btn-square"
				type="button"
				onClick={() => setModal(true)}
			>
				<FilterIcon className="size-4" />
			</button>
			<Modal
				className="modal-bottom"
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
					<h2>Filters</h2>
					<div>
						<form.Field name="title">
							{(field) => (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										Title:
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
										Location:
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
										Show deleted?
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

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CalendarCogIcon,
	CalendarDaysIcon,
	Clock10Icon,
	DownloadIcon,
	EditIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import {
	createResponse,
	deleteAppointment,
	getAppointment,
} from "@/api/appointments";
import { UpdateForm } from "@/components/appointments/UpdateForm";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Modal } from "@/components/modal/Modal";
import { notify } from "@/components/Toast";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/appts/$apptId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getAppointment({ data: { id: params.apptId } });

		const res = await data.json();
		if (data.status < 400) {
			return { appointment: res.data };
		}

		throw new Error(res.message);
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.appointment?.shortTitle,
			},
		],
	}),
});

function RouteComponent() {
	const { user } = Route.useRouteContext();
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isEditing, setIsEditing] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);

	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const createResponseServerFn = useServerFn(createResponse);

	const { appointment } = Route.useLoaderData();
	const router = useRouter();
	if (!appointment) return <div>Appointment not found.</div>;

	const userResponse =
		appointment.responses?.find((r) => r.userId === user?.id)?.responseType ??
		"MAYBE";
	const isAccepted = userResponse === "ACCEPT";
	const isDeclined = userResponse === "DECLINE";
	const isMaybe = userResponse === "MAYBE";

	const isMultipleDays =
		appointment.endDate !== null
			? new Date(appointment.startDate).getDate() !==
				new Date(appointment.endDate).getDate()
			: false;

	const isDeleted = appointment.deletedAt !== null;

	const onEdit = () => {
		setIsEditing(true);
	};
	const onStopEditing = () => {
		setIsEditing(false);
	};

	const onOpenDelete = () => {
		setIsDeleting(true);
	};
	const onStopDeleting = () => {
		setIsDeleting(false);
	};

	const onDelete = async () => {
		const res = await deleteAppointmentServerFn({
			data: { id: appointment.id },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			notify({ text: data.message, status: "success" });
			await router.navigate({
				to: "/",
			});
			return;
		}
		notify({ text: data.message, status: "error" });
	};

	const onResponse = (response: ResponseType) => async () => {
		const res = await createResponseServerFn({
			data: { appointmentId: appointment.id, response },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			return;
		}
		notify({ text: data.message, status: "error" });
	};

	return (
		<div>
			{isDeleted ? (
				<div role="alert" className="alert alert-error alert-soft mb-4">
					<span>
						Appointment was deleted.{" "}
						{canEdit && (
							<button type="button" className="underline hover:cursor-pointer">
								Restore?
							</button>
						)}
					</span>
				</div>
			) : (
				appointment?.status === AppointmentStatus.DRAFT && (
					<div role="alert" className="alert alert-warning alert-soft mb-4">
						<span>
							Appointment is still in draft.{" "}
							{canEdit && (
								<button
									type="button"
									className="underline hover:cursor-pointer"
								>
									Publish?
								</button>
							)}
						</span>
					</div>
				)
			)}
			<div className="grid grid-cols-4 gap-2">
				<h1 className="col-span-4 mb-2 font-bold">{appointment.title}</h1>
				<Card title="Date" icon={CalendarDaysIcon} gridRows={3}>
					<div className="flex flex-row">
						<p>
							{new Date(appointment.startDate).toLocaleDateString("de-DE", {
								year: "numeric",
								month: "short",
								day: "2-digit",
							})}

							{isMultipleDays && appointment.endDate && (
								<>
									{" "}
									-{" "}
									{new Date(appointment.endDate).toLocaleDateString("de-DE", {
										year: "numeric",
										month: "short",
										day: "2-digit",
									})}
								</>
							)}
						</p>
					</div>
				</Card>
				<Card title="Time" icon={Clock10Icon} gridRows={1}>
					<p>
						{new Date(appointment.startDate).toLocaleTimeString("de-DE", {
							timeStyle: "short",
						})}
					</p>
				</Card>
				{appointment.type !== AppointmentType.HOLIDAY && (
					<Card title="Location" icon={Clock10Icon} gridRows={4}>
						<p>{appointment.location || "No location set"}</p>
					</Card>
				)}
			</div>
			{/*User response*/}
			<div className="mt-6 grid grid-cols-3 gap-2">
				<button
					type="button"
					className={cn(
						"btn btn-soft btn-success w-auto",
						isAccepted && "btn-active",
					)}
					disabled={isDeleted}
					onClick={onResponse("ACCEPT")}
				>
					Accept
				</button>
				<button
					type="button"
					className={cn("btn btn-soft btn-warning", isMaybe && "btn-active")}
					disabled={isDeleted}
					onClick={onResponse("MAYBE")}
				>
					Maybe
				</button>
				<button
					type="button"
					className={cn("btn btn-soft btn-error", isDeclined && "btn-active")}
					disabled={isDeleted}
					onClick={onResponse("DECLINE")}
				>
					Response
				</button>
			</div>

			<div className="fab">
				{/** biome-ignore lint/a11y/useSemanticElements: fixes safari bug */}
				<div className="btn btn-lg btn-circle" role="button" tabIndex={0}>
					<CalendarCogIcon className="size-4" />
				</div>
				<button className="btn btn-lg btn-circle" type="button">
					<DownloadIcon className="size-4" />
				</button>
				{canEdit && (
					<>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title="Edit appointment"
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</button>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title="Delete appointment"
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</button>
					</>
				)}
			</div>

			<Modal className="modal-bottom" open={isEditing} onClose={onStopEditing}>
				<UpdateForm appointment={appointment} />
			</Modal>

			<DeleteModal
				label="Are you sure you want to delete this appointment?"
				open={isDeleting}
				onClose={onStopDeleting}
				onDelete={onDelete}
			/>
		</div>
	);
}

type CardProps = {
	title?: string;
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	gridRows?: 1 | 2 | 3 | 4;
};
const Card = (props: React.PropsWithChildren<CardProps>) => {
	const span = {
		1: "col-span-1",
		2: "col-span-2",
		3: "col-span-3",
		4: "col-span-4",
	};
	return (
		<div className={`card bg-base-200 ${span[props.gridRows || 1]}`}>
			<div className="card-body p-4">
				{props.title && (
					<h2 className="card-title text-base">
						{/* {props.icon && <props.icon className="my-1.5 size-4" />} */}
						{props.title}
					</h2>
				)}
				{props.children}
			</div>
		</div>
	);
};

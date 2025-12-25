import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CalendarCogIcon,
	CalendarDaysIcon,
	Clock10Icon,
	DownloadIcon,
	EditIcon,
	ExternalLinkIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import {
	createResponse,
	deleteAppointment,
	getAppointment,
	publishAppointment,
	restoreAppointment,
} from "@/api/appointments";
import { getUniqueCategories } from "@/api/placements";
import { getPlayers } from "@/api/players";
import { UpdateForm } from "@/components/appointments/UpdateForm";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Modal } from "@/components/modal/Modal";
import { ParticipantModal } from "@/components/placement/PlacementModal";
import { notify } from "@/components/Toast";
import { Card } from "@/components/ValueCard";
import { IcalGenerator } from "@/lib/ical";
import type { Response, User } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { cn, createColorForUserId, createGoogleMapsLink } from "@/lib/utils";

export const Route = createFileRoute("/_authed/appts/$apptId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const apptData = await getAppointment({ data: { id: params.apptId } });

		const res = await apptData.json();
		if (apptData.status >= 400) {
			throw new Error(res.message);
		}

		const playerData = await getPlayers();
		const players = await playerData.json();
		if (playerData.status >= 400) {
			throw new Error(res.message);
		}

		const categoriesData = await getUniqueCategories();
		const categories = await categoriesData.json();
		if (categoriesData.status >= 400) {
			throw new Error(res.message);
		}

		return {
			appointment: res.data,
			players: players.data,
			categories: categories.data,
		};
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
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] =
		React.useState(false);

	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const createResponseServerFn = useServerFn(createResponse);
	const publish = useServerFn(publishAppointment);
	const restore = useServerFn(restoreAppointment);

	const { appointment, players, categories } = Route.useLoaderData();
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

	const uniqueParticipants = new Set(
		appointment.placements.map((p) => p.playerId),
	);

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

	const onOpenParticipants = () => {
		setIsParticipantsModalOpen(true);
	};
	const onCloseParticipants = () => {
		setIsParticipantsModalOpen(false);
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

	const onPublish = async () => {
		await publish({ data: { id: appointment.id } });
		await router.invalidate();
	};

	const onRestore = async () => {
		await restore({ data: { id: appointment.id } });
		await router.invalidate();
	};

	const onDownloadIcal = async () => {
		const icalGenerator = new IcalGenerator();
		icalGenerator.createAndDownloadIcalFile(appointment);
	};

	return (
		<div>
			{isDeleted ? (
				<div role="alert" className="alert alert-error alert-soft mb-4">
					<span>
						Appointment was deleted.{" "}
						{canEdit && (
							<button
								type="button"
								className="underline hover:cursor-pointer"
								onClick={onRestore}
							>
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
									onClick={onPublish}
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
					<>
						<Card title="Location" icon={Clock10Icon} gridRows={4}>
							<p>
								{appointment.location ? (
									<a
										href={createGoogleMapsLink(appointment.location)}
										target="_blank"
										className="flex"
									>
										{appointment.location}
										<ExternalLinkIcon className="size-4 inline-block ml-2 self-center" />
									</a>
								) : (
									"No location set"
								)}
							</p>
						</Card>
						<Card title="Participants" gridRows={2}>
							<p className="flex flex-row items-center">
								<span className="flex-1">{uniqueParticipants.size}</span>
								<button
									type="button"
									className="btn btn-link btn-primary shrink h-5"
									onClick={onOpenParticipants}
								>
									Show all
								</button>
							</p>
						</Card>
						<Card title="Link" icon={Clock10Icon} gridRows={2}>
							<p>
								{appointment.link ? (
									<a
										href={appointment.link}
										title={appointment.link}
										target="_blank"
										className="flex flex-nowrap text-nowrap overflow-hidden"
									>
										<ExternalLinkIcon className="size-4 mr-2 self-center shrink-0" />
										{appointment.link}
									</a>
								) : (
									"No link set"
								)}
							</p>
						</Card>
					</>
				)}
			</div>
			{/*User response*/}
			{appointment.type === AppointmentType.TOURNAMENT_BY && (
				<>
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
							className={cn(
								"btn btn-soft btn-warning",
								isMaybe && "btn-active",
							)}
							disabled={isDeleted}
							onClick={onResponse("MAYBE")}
						>
							Maybe
						</button>
						<button
							type="button"
							className={cn(
								"btn btn-soft btn-error",
								isDeclined && "btn-active",
							)}
							disabled={isDeleted}
							onClick={onResponse("DECLINE")}
						>
							Response
						</button>
					</div>

					<div className="mt-3 grid grid-cols-3 gap-2">
						<AvatarGroup
							responses={appointment.responses.filter(
								(r) => r.responseType === "ACCEPT",
							)}
						/>
						<div></div>
						<AvatarGroup
							responses={appointment.responses.filter(
								(r) => r.responseType === "DECLINE",
							)}
						/>
					</div>
				</>
			)}

			<div className="fab">
				{/** biome-ignore lint/a11y/useSemanticElements: fixes safari bug */}
				<div className="btn btn-lg btn-circle" role="button" tabIndex={0}>
					<CalendarCogIcon className="size-4" />
				</div>
				<button
					className="btn btn-lg btn-circle"
					type="button"
					onClick={onDownloadIcal}
				>
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

			<ParticipantModal
				open={isParticipantsModalOpen}
				onClose={onCloseParticipants}
				placements={appointment.placements}
				players={players ?? []}
				appointmentId={appointment.id}
				categories={categories ?? []}
			/>
		</div>
	);
}

type AvatarGroupProps = {
	responses: (Response & { user: User })[];
};
const AvatarGroup = ({ responses }: AvatarGroupProps) => {
	return (
		<div className="-space-x-3">
			{responses.map((r) => (
				<div
					key={r.userId}
					className="avatar avatar-placeholder tooltip"
					data-tip={r.user.name}
				>
					<div
						className="bg-neutral w-8 rounded-full border-base-100 border-2"
						style={{ backgroundColor: createColorForUserId(r.userId) }}
					>
						<span className="text-md light:text-white">
							{r.user.name.slice(0, 2)}
						</span>
					</div>
				</div>
			))}
		</div>
	);
};

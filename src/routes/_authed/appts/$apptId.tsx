import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CogIcon,
	DownloadIcon,
	ExternalLinkIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	createResponse,
	deleteAppointment,
	getAppointment,
	getAppointments,
	publishAppointment,
	restoreAppointment,
	updateAppointment,
} from "@/api/appointments";
import { getUniqueCategories } from "@/api/placements";
import { getPlayers } from "@/api/players";
import { EditableDateCard } from "@/components/appointments/editable/EditableDateCard";
import { EditableHeader } from "@/components/appointments/editable/EditableHeader";
import { EditableNextAppointmentCard } from "@/components/appointments/editable/EditableNextAppointmentCard";
import { EditableTextCard } from "@/components/appointments/editable/EditableTextCard";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { ParticipantModal } from "@/components/placement/PlacementModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card } from "@/components/ValueCard";
import { IcalGenerator } from "@/lib/ical";
import type { Appointment, Response, User } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import {
	cn,
	createColorForUserId,
	createGoogleMapsLink,
	shortenUserName,
} from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/appts/$apptId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const apptData = await getAppointment({ data: { id: params.apptId } });

		const res = await apptData.json();
		if (apptData.status >= 400) {
			throw new Error(res.message);
		}

		const [playerData, categoriesData, apptsData] = await Promise.all([
			getPlayers(),
			getUniqueCategories(),
			getAppointments({
				data: { minDate: res.data?.startDate, orderBy: { startDate: "desc" } },
			}),
		]);

		const players = await playerData.json();
		if (playerData.status >= 400) {
			throw new Error(res.message);
		}

		const categories = await categoriesData.json();
		if (categoriesData.status >= 400) {
			throw new Error(res.message);
		}

		const appointments = await apptsData.json();
		if (apptsData.status >= 400) {
			throw new Error(res.message);
		}

		return {
			appointment: res.data,
			appointments: appointments.data,
			categories: categories.data,
			players: players.data,
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

	const [isDeleting, setIsDeleting] = React.useState(false);
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] =
		React.useState(false);

	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const createResponseServerFn = useServerFn(createResponse);
	const publish = useServerFn(publishAppointment);
	const restore = useServerFn(restoreAppointment);
	const updateAppointmentServerFn = useServerFn(updateAppointment);

	const { appointment, players, categories, appointments } =
		Route.useLoaderData();
	const router = useRouter();

	if (!appointment) return <div>{t("Appointment not found.")}</div>;

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
			toast.success(data.message);
			await router.navigate({
				to: "..",
			});
			return;
		}
		toast.error(data.message);
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
		toast.error(data.message);
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

	const onSaveField = async (updates: Partial<Appointment>) => {
		const res = await updateAppointmentServerFn({
			data: { id: appointment.id, updates },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			toast.success(data.message);
			return true;
		}
		toast.error(data.message);
		return false;
	};

	const mainContentProps = {
		appointment,
		canEdit,
		isAccepted,
		isDeclined,
		isDeleted,
		isMaybe,
		isMultipleDays,
		onOpenParticipants,
		onResponse,
		onSaveField,
		otherAppointments: appointments ?? [],
		uniqueParticipants,
	};

	return (
		<div>
			{/* Desktop toolbar */}
			<div className="mb-4 hidden items-center gap-2 lg:flex">
				<span className="text-muted-foreground text-sm">
					{t("Appointments")} /
				</span>
				<span className="flex-1 font-semibold text-[15px]">
					{appointment.title}
				</span>
				<Button variant="outline" size="sm" onClick={onDownloadIcal}>
					<DownloadIcon className="size-4" />
					{t("Download iCal")}
				</Button>
				{canEdit && (
					<Button
						variant="outline"
						size="sm"
						className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
						onClick={onOpenDelete}
					>
						<Trash2Icon className="size-4" />
						{t("Delete appointment")}
					</Button>
				)}
			</div>

			{isDeleted ? (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>
						{t("Appointment was deleted.")}{" "}
						{canEdit && (
							<button
								type="button"
								className="underline hover:cursor-pointer"
								onClick={onRestore}
							>
								{t("Restore?")}
							</button>
						)}
					</AlertDescription>
				</Alert>
			) : (
				appointment?.status === AppointmentStatus.DRAFT && (
					<Alert variant="warning" className="mb-4">
						<AlertDescription>
							{t("Appointment is still in draft.")}{" "}
							{canEdit && (
								<button
									type="button"
									className="underline hover:cursor-pointer"
									onClick={onPublish}
								>
									{t("Publish?")}
								</button>
							)}
						</AlertDescription>
					</Alert>
				)
			)}

			{/* Mobile / tablet: single column */}
			<div className="lg:hidden">
				<AppointmentMainContent {...mainContentProps} />
				{appointment.location && (
					<div className="mt-4 hidden md:block lg:hidden">
						<iframe
							src={`https://maps.google.com/maps?hl=de&t=&z=14&ie=UTF8&iwloc=B&output=embed&q=${appointment.location},+Deutschland`}
							className="h-96 w-full"
							title="Google Maps"
						></iframe>
					</div>
				)}
			</div>

			{/* Desktop: two columns */}
			<div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
				<div className="min-w-0">
					<AppointmentMainContent {...mainContentProps} />
				</div>
				<div className="flex min-w-0 flex-col gap-4">
					{appointment.location ? (
						<iframe
							src={`https://maps.google.com/maps?hl=de&t=&z=14&ie=UTF8&iwloc=B&output=embed&q=${appointment.location},+Deutschland`}
							className="h-72 w-full rounded-lg border border-border/40"
							title="Google Maps"
						></iframe>
					) : (
						<div className="flex h-72 items-center justify-center rounded-lg border border-border/40 text-muted-foreground text-sm">
							{t("No location set")}
						</div>
					)}
					<div className="rounded-lg bg-card p-4">
						<div className="mb-3 flex items-center justify-between">
							<span className="font-bold text-sm">
								{t("Participants")} · {uniqueParticipants.size}
							</span>
							<Button
								type="button"
								variant="link"
								className="h-5"
								onClick={onOpenParticipants}
							>
								{t("Show all")}
							</Button>
						</div>
						<AvatarGroup
							responses={appointment.responses.filter(
								(r) => r.responseType === "ACCEPT",
							)}
						/>
					</div>
				</div>
			</div>

			<div className="fab lg:hidden">
				<Button
					asChild
					variant="secondary"
					size="icon-lg"
					role="button"
					tabIndex={0}
				>
					<div>
						<CogIcon className="size-4" />
					</div>
				</Button>
				<Button
					variant="secondary"
					size="icon-lg"
					type="button"
					title={t("Download iCal")}
					onClick={onDownloadIcal}
				>
					<DownloadIcon className="size-4" />
				</Button>
				{canEdit && (
					<Button
						variant="secondary"
						size="icon-lg"
						type="button"
						title={t("Delete appointment")}
						onClick={onOpenDelete}
					>
						<Trash2Icon className="size-4" />
					</Button>
				)}
			</div>

			<DeleteModal
				label={t("Are you sure you want to delete this appointment?")}
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

type AppointmentMainContentProps = {
	appointment: NonNullable<
		ReturnType<typeof Route.useLoaderData>["appointment"]
	>;
	isMultipleDays: boolean;
	uniqueParticipants: Set<string>;
	isAccepted: boolean;
	isDeclined: boolean;
	isMaybe: boolean;
	isDeleted: boolean;
	canEdit: boolean;
	onOpenParticipants: () => void;
	onResponse: (response: ResponseType) => () => Promise<void>;
	onSaveField: (updates: Partial<Appointment>) => Promise<boolean>;
	otherAppointments: Appointment[];
};
const AppointmentMainContent = ({
	appointment,
	isMultipleDays,
	uniqueParticipants,
	isAccepted,
	isDeclined,
	isMaybe,
	isDeleted,
	canEdit,
	onOpenParticipants,
	onResponse,
	onSaveField,
	otherAppointments,
}: AppointmentMainContentProps) => {
	return (
		<>
			<div className="grid grid-cols-4 gap-2">
				<EditableHeader
					title={appointment.title}
					shortTitle={appointment.shortTitle}
					canEdit={canEdit}
					onSave={(v) => onSaveField(v)}
					className="col-span-4 mb-2"
				/>
				<EditableDateCard
					startDate={new Date(appointment.startDate)}
					endDate={appointment.endDate ? new Date(appointment.endDate) : null}
					isMultipleDays={isMultipleDays}
					canEdit={canEdit}
					onSave={(v) => onSaveField(v)}
				/>
				{appointment.type !== AppointmentType.HOLIDAY && (
					<>
						<EditableTextCard
							title={t("Location")}
							gridRows={4}
							canEdit={canEdit}
							value={appointment.location ?? ""}
							placeholder={t("No location set")}
							displayValue={
								appointment.location ? (
									<a
										href={createGoogleMapsLink(appointment.location)}
										target="_blank"
										className="flex"
									>
										{appointment.location}
										<ExternalLinkIcon className="size-4 inline-block ml-2 self-center" />
									</a>
								) : undefined
							}
							onSave={(v) => onSaveField({ location: v })}
						/>
						<Card title={t("Participants")} gridRows={2}>
							<p className="flex flex-row items-center">
								<span className="flex-1">{uniqueParticipants.size}</span>
								<Button
									type="button"
									variant="link"
									className="shrink h-5"
									onClick={onOpenParticipants}
								>
									{t("Show all")}
								</Button>
							</p>
						</Card>
						<EditableTextCard
							title={t("Link")}
							gridRows={2}
							canEdit={canEdit}
							value={appointment.link ?? ""}
							placeholder={t("No link set")}
							displayValue={
								appointment.link ? (
									<a
										href={appointment.link}
										title={appointment.link}
										target="_blank"
										className="flex flex-nowrap text-nowrap overflow-hidden"
									>
										<ExternalLinkIcon className="size-4 mr-2 self-center shrink-0" />
										{appointment.link}
									</a>
								) : undefined
							}
							onSave={(v) => onSaveField({ link: v })}
						/>
						<EditableNextAppointmentCard
							appointmentId={appointment.id}
							nextAppointmentId={appointment.nextAppointmentId}
							nextAppointment={appointment.nextAppointment}
							otherAppointments={otherAppointments}
							canEdit={canEdit}
							onSave={(id) => onSaveField({ nextAppointmentId: id })}
						/>
					</>
				)}
			</div>
			{/*User response*/}
			{appointment.type === AppointmentType.TOURNAMENT && (
				<>
					<div className="mt-6 grid grid-cols-3 gap-2">
						<Button
							type="button"
							variant="ghost"
							className={cn(
								"w-auto border border-success/30 text-success hover:bg-success/15 hover:text-success",
								isAccepted &&
									"border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground",
							)}
							disabled={isDeleted}
							onClick={onResponse("ACCEPT")}
						>
							{isAccepted ? t("Accepted") : t("Accept")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							className={cn(
								"border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning",
								isMaybe &&
									"border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground",
							)}
							disabled={isDeleted}
							onClick={onResponse("MAYBE")}
						>
							{isMaybe ? t("Maybe") : t("Maybe")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							className={cn(
								"border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
								isDeclined &&
									"border-destructive bg-destructive text-white hover:bg-destructive/90",
							)}
							disabled={isDeleted}
							onClick={onResponse("DECLINE")}
						>
							{isDeclined ? t("Declined") : t("Decline")}
						</Button>
					</div>

					<div className="mt-2 grid grid-cols-3 gap-2">
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
		</>
	);
};

type AvatarGroupProps = {
	responses: (Response & { user: User })[];
};
const AvatarGroup = ({ responses }: AvatarGroupProps) => {
	return (
		<div className="-space-x-3">
			{responses.map((r) => {
				const userColor = createColorForUserId(r.userId);
				return (
					<Tooltip key={r.userId}>
						<TooltipTrigger asChild>
							<Avatar className="border-2 border-background">
								<AvatarFallback
									style={{
										backgroundColor: userColor.backgroundColor,
										color: userColor.foregroundColor,
									}}
								>
									{shortenUserName(r.user.name)}
								</AvatarFallback>
							</Avatar>
						</TooltipTrigger>
						<TooltipContent>{r.user.name}</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
};

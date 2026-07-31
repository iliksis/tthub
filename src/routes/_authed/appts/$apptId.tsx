import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	DownloadIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
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
	unpublishAppointment,
	updateAppointment,
} from "@/api/appointments";
import { getUniqueCategories } from "@/api/placements";
import { getPlayers } from "@/api/players";
import { EditableNextAppointmentCard } from "@/components/appointments/editable/EditableNextAppointmentCard";
import { RecordInfoPanel } from "@/components/appointments/RecordInfoPanel";
import { ResponsesPanel } from "@/components/appointments/ResponsesPanel";
import { TransactionHistory } from "@/components/appointments/TransactionHistory";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { ParticipantModal } from "@/components/placement/PlacementModal";
import { PlacementsPanel } from "@/components/placement/PlacementsPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { IcalGenerator } from "@/lib/ical";
import type { Appointment } from "@/lib/prisma/client";
import {
	AppointmentStatus,
	AppointmentType,
	type ResponseType,
} from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, createGoogleMapsLink, dateToInputValue } from "@/lib/utils";

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

function typeLabel(type: string) {
	if (type === AppointmentType.HOLIDAY) return t("Holiday");
	if (type === AppointmentType.TOURNAMENT_DE) return t("Tournament (Germany)");
	return t("Tournament");
}

function formatDateTime(date: Date | string) {
	return new Date(date).toLocaleString("de-DE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "short",
		weekday: "short",
	});
}

type EditableDraft = {
	title: string;
	shortTitle: string;
	location: string;
	link: string;
	startDate: Date;
	endDate: Date | null;
};

function RouteComponent() {
	const { user } = Route.useRouteContext();
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isDeleting, setIsDeleting] = React.useState(false);
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] =
		React.useState(false);
	const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
	const [draft, setDraft] = React.useState<EditableDraft>({
		endDate: null,
		link: "",
		location: "",
		shortTitle: "",
		startDate: new Date(),
		title: "",
	});

	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const createResponseServerFn = useServerFn(createResponse);
	const publish = useServerFn(publishAppointment);
	const unpublish = useServerFn(unpublishAppointment);
	const restore = useServerFn(restoreAppointment);
	const updateAppointmentServerFn = useServerFn(updateAppointment);

	const { appointment, players, categories, appointments } =
		Route.useLoaderData();
	const router = useRouter();

	if (!appointment) return <div>{t("Appointment not found.")}</div>;

	const isDeleted = appointment.deletedAt !== null;
	const isHoliday = appointment.type === AppointmentType.HOLIDAY;
	const isPublished = appointment.status === AppointmentStatus.PUBLISHED;

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

	const onUnpublish = async () => {
		await unpublish({ data: { id: appointment.id } });
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

	const onStartEdit = () => {
		setDraft({
			endDate: appointment.endDate ? new Date(appointment.endDate) : null,
			link: appointment.link ?? "",
			location: appointment.location ?? "",
			shortTitle: appointment.shortTitle,
			startDate: new Date(appointment.startDate),
			title: appointment.title,
		});
		setIsEditSheetOpen(true);
	};
	const onSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		const ok = await onSaveField(draft);
		if (ok) setIsEditSheetOpen(false);
	};

	return (
		<div>
			{isDeleted && (
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
			)}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
				<div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
					<Card>
						<CardContent>
							<div className="mb-4 flex flex-wrap items-start justify-between gap-4">
								<div className="min-w-0">
									<div className="mb-2 flex items-center gap-2">
										<Badge variant="outline">
											{typeLabel(appointment.type)}
										</Badge>
										{!isHoliday && canEdit && (
											<button
												type="button"
												onClick={isPublished ? onUnpublish : onPublish}
												className="group rounded-full"
												aria-label={
													isPublished
														? t("Unpublish appointment")
														: t("Publish appointment")
												}
											>
												<Badge
													variant={isPublished ? "success" : "warning"}
													className={cn(
														"cursor-pointer gap-1 transition-shadow",
														isPublished
															? "group-hover:ring-2 group-hover:ring-success/40"
															: "group-hover:ring-2 group-hover:ring-warning/40",
													)}
												>
													{isPublished ? t("Published") : t("Draft")}
													<RefreshCwIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
												</Badge>
											</button>
										)}
										{!isHoliday && !canEdit && (
											<Badge variant={isPublished ? "success" : "warning"}>
												{isPublished ? t("Published") : t("Draft")}
											</Badge>
										)}
									</div>
									<div>
										<h1 className="font-bold text-2xl">{appointment.title}</h1>
										<p className="text-muted-foreground text-sm">
											{appointment.shortTitle}
										</p>
									</div>
								</div>
							</div>

							<div
								className={cn(
									"mb-6 grid grid-cols-1 items-start gap-4 border-border/60 border-t pt-4",
									isHoliday ? "sm:grid-cols-2" : "sm:grid-cols-3",
								)}
							>
								<div>
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{t("Start")}
									</div>
									<div>{formatDateTime(appointment.startDate)}</div>
								</div>
								<div>
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{t("End")}
									</div>
									<div>
										{appointment.endDate
											? formatDateTime(appointment.endDate)
											: "—"}
									</div>
								</div>
								{!isHoliday && (
									<div>
										<div className="mb-1 text-muted-foreground text-xs uppercase">
											{t("Location")}
										</div>
										{appointment.location ? (
											<a
												href={createGoogleMapsLink(appointment.location)}
												target="_blank"
												rel="noreferrer"
												className="flex items-center gap-1 hover:underline"
											>
												{appointment.location}
												<ExternalLinkIcon className="size-3.5" />
											</a>
										) : (
											<span className="text-muted-foreground">
												{t("No location set")}
											</span>
										)}
									</div>
								)}
							</div>

							{!isHoliday && appointment.location && (
								<div className="mb-6">
									<iframe
										src={`https://maps.google.com/maps?hl=de&t=&z=14&ie=UTF8&iwloc=B&output=embed&q=${appointment.location},+Deutschland`}
										className="h-64 w-full rounded-lg border border-border/40"
										title="Google Maps"
									/>
								</div>
							)}

							{!isHoliday && (
								<div className="mb-6">
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{t("Link")}
									</div>
									{appointment.link ? (
										<a
											href={appointment.link}
											target="_blank"
											rel="noreferrer"
											className="flex items-center gap-1 text-primary hover:underline"
										>
											<ExternalLinkIcon className="size-3.5" />
											{t("Join")}
										</a>
									) : (
										<span className="text-muted-foreground">
											{t("No link set")}
										</span>
									)}
								</div>
							)}

							{!isHoliday && (
								<EditableNextAppointmentCard
									appointmentId={appointment.id}
									nextAppointmentId={appointment.nextAppointmentId}
									nextAppointment={appointment.nextAppointment}
									otherAppointments={appointments ?? []}
									canEdit={canEdit}
									onSave={(id) => onSaveField({ nextAppointmentId: id })}
								/>
							)}
						</CardContent>
					</Card>

					{!isHoliday && (
						<PlacementsPanel
							placements={appointment.placements}
							canEdit={canEdit}
							onManage={onOpenParticipants}
						/>
					)}
				</div>

				<div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6">
					<div className="flex shrink-0 flex-wrap justify-end gap-2">
						<Button variant="outline" size="sm" onClick={onDownloadIcal}>
							<DownloadIcon className="size-4" />
							{t("Download iCal")}
						</Button>
						{canEdit && (
							<Button variant="outline" size="sm" onClick={onStartEdit}>
								{t("Edit")}
							</Button>
						)}
						{canEdit && (
							<Button
								variant="outline"
								size="sm"
								className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
								disabled={isDeleted}
								onClick={onOpenDelete}
							>
								<Trash2Icon className="size-4" />
								{t("Cancel")}
							</Button>
						)}
					</div>
					<RecordInfoPanel
						createdAt={new Date(appointment.createdAt)}
						lastUpdated={
							appointment.transactions[0]
								? new Date(appointment.transactions[0].createdAt)
								: new Date(appointment.createdAt)
						}
					/>
					{appointment.type === AppointmentType.TOURNAMENT && (
						<ResponsesPanel
							responses={appointment.responses}
							currentUserId={user?.id}
							isDeleted={isDeleted}
							onResponse={onResponse}
						/>
					)}
					<TransactionHistory transactions={appointment.transactions} />
				</div>
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

			<Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
				<SheetContent className="w-full sm:max-w-md">
					<SheetHeader>
						<SheetTitle>{t("Edit appointment")}</SheetTitle>
					</SheetHeader>
					<form
						id="edit-appointment"
						className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
						onSubmit={onSaveEdit}
					>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="title">{t("Title")}</Label>
							<Input
								id="title"
								autoFocus
								value={draft.title}
								onChange={(e) => setDraft({ ...draft, title: e.target.value })}
							/>
						</fieldset>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="shortTitle">{t("ShortTitle")}</Label>
							<Input
								id="shortTitle"
								value={draft.shortTitle}
								onChange={(e) =>
									setDraft({ ...draft, shortTitle: e.target.value })
								}
							/>
						</fieldset>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="startDate">{t("StartDate")}</Label>
							<Input
								id="startDate"
								type="datetime-local"
								value={dateToInputValue(draft.startDate)}
								onChange={(e) =>
									setDraft({
										...draft,
										startDate: new Date(e.target.value),
									})
								}
							/>
						</fieldset>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="endDate">{t("EndDate")}</Label>
							<Input
								id="endDate"
								type="date"
								value={
									draft.endDate ? dateToInputValue(draft.endDate, false) : ""
								}
								onChange={(e) =>
									setDraft({
										...draft,
										endDate: e.target.value ? new Date(e.target.value) : null,
									})
								}
							/>
						</fieldset>
						{!isHoliday && (
							<>
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor="location">{t("Location")}</Label>
									<Input
										id="location"
										value={draft.location}
										onChange={(e) =>
											setDraft({ ...draft, location: e.target.value })
										}
									/>
								</fieldset>
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor="link">{t("Link")}</Label>
									<Input
										id="link"
										value={draft.link}
										onChange={(e) =>
											setDraft({ ...draft, link: e.target.value })
										}
									/>
								</fieldset>
							</>
						)}
					</form>
					<SheetFooter>
						<div className="flex justify-end gap-2">
							<SheetClose asChild>
								<Button variant="secondary">{t("Cancel")}</Button>
							</SheetClose>
							<Button type="submit" form="edit-appointment">
								{t("Save")}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	ChevronDownIcon,
	DownloadIcon,
	PencilIcon,
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
import { getLabels } from "@/api/labels";
import { getUniqueCategories } from "@/api/placements";
import { getPlayers } from "@/api/players";
import { getSeasons } from "@/api/seasons";
import { EditableNextAppointmentCard } from "@/components/appointments/editable/EditableNextAppointmentCard";
import { RecordInfoPanel } from "@/components/appointments/RecordInfoPanel";
import { ResponsesPanel } from "@/components/appointments/ResponsesPanel";
import { TransactionHistory } from "@/components/appointments/TransactionHistory";
import { LabelBadges } from "@/components/labels/LabelBadges";
import { LabelMultiSelect } from "@/components/labels/LabelMultiSelect";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlacementsPanel } from "@/components/placement/PlacementsPanel";
import { PlacementsSheet } from "@/components/placement/PlacementsSheet";
import { Section } from "@/components/Section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EntitySelect } from "@/components/ui/entity-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
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
	ResponseType,
} from "@/lib/prisma/enums";
import {
	cn,
	createGoogleMapsLink,
	dateToInputValue,
	isEditorOrAdmin,
	isInformationalAppointmentType,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/appts/$apptId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const res = await getAppointment({ data: { id: params.apptId } });

		const [players, categories, appointments, seasons, labels] =
			await Promise.all([
				getPlayers({ data: {} }),
				getUniqueCategories(),
				getAppointments({
					data: {
						minDate: res.data?.startDate,
						orderBy: { startDate: "desc" },
					},
				}),
				getSeasons(),
				getLabels(),
			]);

		return {
			appointment: res.data,
			appointments: appointments.data,
			categories: categories.data,
			labels: labels.data ?? [],
			players: players.data,
			seasons: seasons.data ?? [],
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData?.appointment?.title,
			},
		],
	}),
});

function typeLabel(type: string) {
	if (type === AppointmentType.HOLIDAY) return m.common_holiday();
	if (type === AppointmentType.TEAM_MATCH) return m.appointments_team_match();
	return m.common_tournament();
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
	location: string;
	link: string;
	startDate: Date;
	endDate: Date | null;
	seasonId: string;
	labelIds: string[];
};

function RouteComponent() {
	const { user } = Route.useRouteContext();
	const canEdit = isEditorOrAdmin(user?.role);

	const [isDeleting, setIsDeleting] = React.useState(false);
	const [isParticipantsModalOpen, setIsParticipantsModalOpen] =
		React.useState(false);
	const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
	const [draft, setDraft] = React.useState<EditableDraft>({
		endDate: null,
		labelIds: [],
		link: "",
		location: "",
		seasonId: "",
		startDate: new Date(),
		title: "",
	});

	const deleteAppointmentServerFn = useServerFn(deleteAppointment);
	const createResponseServerFn = useServerFn(createResponse);
	const publish = useServerFn(publishAppointment);
	const unpublish = useServerFn(unpublishAppointment);
	const restore = useServerFn(restoreAppointment);
	const updateAppointmentServerFn = useServerFn(updateAppointment);

	const { appointment, players, categories, appointments, seasons, labels } =
		Route.useLoaderData();
	const router = useRouter();

	if (!appointment)
		return <div>{m.appointments_appointment_not_found_2()}</div>;

	const isDeleted = appointment.deletedAt !== null;
	const isHoliday = isInformationalAppointmentType(appointment.type);
	const isPublished = appointment.status === AppointmentStatus.PUBLISHED;
	const isTournament = appointment.type === AppointmentType.TOURNAMENT;
	const myResponse = appointment.responses.find((r) => r.userId === user?.id);
	const showMobileDock = isTournament;

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
		try {
			const res = await deleteAppointmentServerFn({
				data: { id: appointment.id },
			});
			await router.invalidate();
			toast.success(res.message);
			await router.navigate({
				to: "..",
			});
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onResponse = (response: ResponseType) => async () => {
		try {
			await createResponseServerFn({
				data: { appointmentId: appointment.id, response },
			});
			await router.invalidate();
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onPublish = async () => {
		try {
			await publish({ data: { id: appointment.id } });
			await router.invalidate();
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onUnpublish = async () => {
		try {
			await unpublish({ data: { id: appointment.id } });
			await router.invalidate();
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onRestore = async () => {
		try {
			await restore({ data: { id: appointment.id } });
			await router.invalidate();
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onDownloadIcal = async () => {
		const icalGenerator = new IcalGenerator(window.location.origin);
		icalGenerator.createAndDownloadIcalFile(appointment);
	};

	const onSaveField = async (updates: Partial<Appointment>) => {
		try {
			const res = await updateAppointmentServerFn({
				data: { id: appointment.id, updates },
			});
			await router.invalidate();
			toast.success(res.message);
			return true;
		} catch (err) {
			toast.error((err as Error).message);
			return false;
		}
	};

	const onStartEdit = () => {
		setDraft({
			endDate: appointment.endDate ? new Date(appointment.endDate) : null,
			labelIds: appointment.labels.map((l) => l.labelId),
			link: appointment.link ?? "",
			location: appointment.location ?? "",
			seasonId: appointment.seasonId ?? "",
			startDate: new Date(appointment.startDate),
			title: appointment.title,
		});
		setIsEditSheetOpen(true);
	};
	const onSaveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		// seasonId is only editable (and only shown) for TOURNAMENT — HOLIDAY
		// doesn't need one and TEAM_MATCH's stays derived from its team, so it's
		// dropped from the payload rather than saved as an empty string. Labels
		// only apply to TOURNAMENT appointments too.
		const { seasonId, labelIds, ...rest } = draft;
		const ok = await onSaveField({
			...rest,
			...(isHoliday ? {} : { seasonId }),
			...(isTournament ? { labelIds } : {}),
		});
		if (ok) setIsEditSheetOpen(false);
	};

	return (
		<div>
			{isDeleted && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>
						{m.appointments_appointment_was_deleted()}{" "}
						{canEdit && (
							<button
								type="button"
								className="underline hover:cursor-pointer"
								onClick={onRestore}
							>
								{m.appointments_restore()}
							</button>
						)}
					</AlertDescription>
				</Alert>
			)}

			{/* Mobile layout: single scrolling column with RSVP/edit pinned to a
			    persistent bottom dock, so the most frequent actions never
			    require scrolling back to the top. */}
			<div className="lg:hidden">
				<div
					className={cn(
						"flex flex-col gap-4",
						showMobileDock ? "pb-24" : "pb-4",
					)}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-center gap-2">
							<Badge variant="outline">{typeLabel(appointment.type)}</Badge>
							{appointment.season && (
								<Badge variant="secondary">{appointment.season.name}</Badge>
							)}
							{!isHoliday && canEdit && (
								<button
									type="button"
									onClick={isPublished ? onUnpublish : onPublish}
									className="group rounded-full"
									aria-label={
										isPublished
											? m.appointments_unpublish_appointment()
											: m.appointments_publish_appointment()
									}
								>
									<Badge
										variant={isPublished ? "success" : "warning"}
										className={cn(
											"cursor-pointer gap-1 transition-shadow transition-width",
											isPublished
												? "group-hover:ring-2 group-hover:ring-success/40"
												: "group-hover:ring-2 group-hover:ring-warning/40",
										)}
									>
										{isPublished
											? m.appointments_published()
											: m.appointments_draft()}
										<RefreshCwIcon className="size-0 opacity-0 transition-opacity group-hover:size-3 group-hover:opacity-100" />
									</Badge>
								</button>
							)}
							{!isHoliday && !canEdit && (
								<Badge variant={isPublished ? "success" : "warning"}>
									{isPublished
										? m.appointments_published()
										: m.appointments_draft()}
								</Badge>
							)}
						</div>
						<div className="flex shrink-0 gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-8"
								aria-label={m.appointments_download()}
								onClick={onDownloadIcal}
							>
								<DownloadIcon className="size-4" />
							</Button>
							{canEdit && (
								<Button
									variant="ghost"
									size="icon"
									className="size-8"
									aria-label={m.appointments_edit()}
									onClick={onStartEdit}
								>
									<PencilIcon className="size-4" />
								</Button>
							)}
							{canEdit && (
								<Button
									variant="ghost"
									size="icon"
									className="size-8 text-destructive hover:text-destructive"
									aria-label={m.common_delete()}
									disabled={isDeleted}
									onClick={onOpenDelete}
								>
									<Trash2Icon className="size-4" />
								</Button>
							)}
						</div>
					</div>

					<LabelBadges labels={appointment.labels.map((l) => l.label)} />

					<Section title={m.common_details()}>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<div className="mb-1 text-muted-foreground text-xs uppercase">
									{m.appointments_start()}
								</div>
								<div>{formatDateTime(appointment.startDate)}</div>
							</div>
							<div>
								<div className="mb-1 text-muted-foreground text-xs uppercase">
									{m.appointments_end()}
								</div>
								<div>
									{appointment.endDate
										? formatDateTime(appointment.endDate)
										: "—"}
								</div>
							</div>
							{!isHoliday && (
								<div className="col-span-2">
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{m.appointments_location()}
									</div>
									{appointment.location ? (
										<Link
											href={createGoogleMapsLink(appointment.location)}
											external
										>
											{appointment.location}
										</Link>
									) : (
										<span className="text-muted-foreground">
											{m.appointments_no_location_set()}
										</span>
									)}
								</div>
							)}
							{appointment.ownTeam && (
								<div className="col-span-2">
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{m.common_team()}
									</div>
									<Link
										to="/teams/$teamId"
										params={{ teamId: appointment.ownTeam.id }}
									>
										{appointment.ownTeam.title}
									</Link>
								</div>
							)}
						</div>
					</Section>

					{!isHoliday && appointment.location && (
						<iframe
							src={`https://maps.google.com/maps?hl=de&t=&z=10&ie=UTF8&iwloc=B&output=embed&q=${appointment.location},+Deutschland`}
							className="h-48 w-full rounded-lg border border-border/40"
							title="Google Maps"
						/>
					)}

					{!isHoliday && appointment.link && (
						<Link
							href={appointment.link}
							external
							className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 font-medium text-sm hover:bg-primary/15 hover:no-underline [&_svg]:size-4"
						>
							{appointment.link}
						</Link>
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

					{!isHoliday && (
						<PlacementsPanel
							placements={appointment.placements}
							canEdit={canEdit}
							onManage={onOpenParticipants}
						/>
					)}

					{isTournament && (
						<ResponsesPanel
							responses={appointment.responses}
							currentUserId={user?.id}
							isDeleted={isDeleted}
							onResponse={onResponse}
							showActions={false}
						/>
					)}

					<Collapsible className="rounded-lg bg-card">
						<CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
							<span className="font-bold text-sm">
								{m.appointments_more_details()}
							</span>
							<ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
						</CollapsibleTrigger>
						<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
							<div className="flex flex-col gap-4 px-4 pb-4">
								<RecordInfoPanel
									createdAt={new Date(appointment.createdAt)}
									lastUpdated={
										appointment.transactions[0]
											? new Date(appointment.transactions[0].createdAt)
											: new Date(appointment.createdAt)
									}
								/>
								<TransactionHistory transactions={appointment.transactions} />
							</div>
						</CollapsibleContent>
					</Collapsible>
				</div>

				{showMobileDock && (
					<div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-border/60 border-t bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
						<Button
							variant="ghost"
							className={cn(
								"flex-1 border border-success/30 text-success hover:bg-success/15 hover:text-success",
								myResponse?.responseType === ResponseType.ACCEPT &&
									"border-success bg-success text-success-foreground hover:bg-background hover:text-success-foreground",
							)}
							disabled={isDeleted}
							onClick={onResponse(ResponseType.ACCEPT)}
						>
							{myResponse?.responseType === ResponseType.ACCEPT
								? m.common_accepted()
								: m.common_accept()}
						</Button>
						<Button
							variant="ghost"
							className={cn(
								"flex-1 border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning",
								(!myResponse ||
									myResponse?.responseType === ResponseType.MAYBE) &&
									"border-warning bg-warning text-warning-foreground hover:bg-background hover:text-warning",
							)}
							disabled={isDeleted}
							onClick={onResponse(ResponseType.MAYBE)}
						>
							{m.common_maybe()}
						</Button>
						<Button
							variant="ghost"
							className={cn(
								"flex-1 border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
								myResponse?.responseType === ResponseType.DECLINE &&
									"border-destructive bg-destructive text-white hover:bg-background",
							)}
							disabled={isDeleted}
							onClick={onResponse(ResponseType.DECLINE)}
						>
							{myResponse?.responseType === ResponseType.DECLINE
								? m.common_declined()
								: m.common_decline()}
						</Button>
					</div>
				)}
			</div>

			<div className="hidden gap-6 lg:grid lg:grid-cols-3 lg:items-start">
				<div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="mb-2 flex items-center gap-2">
								<Badge variant="outline">{typeLabel(appointment.type)}</Badge>
								{appointment.season && (
									<Badge variant="secondary">{appointment.season.name}</Badge>
								)}
								{!isHoliday && canEdit && (
									<button
										type="button"
										onClick={isPublished ? onUnpublish : onPublish}
										className="group rounded-full"
										aria-label={
											isPublished
												? m.appointments_unpublish_appointment()
												: m.appointments_publish_appointment()
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
											{isPublished
												? m.appointments_published()
												: m.appointments_draft()}
											<RefreshCwIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
										</Badge>
									</button>
								)}
								{!isHoliday && !canEdit && (
									<Badge variant={isPublished ? "success" : "warning"}>
										{isPublished
											? m.appointments_published()
											: m.appointments_draft()}
									</Badge>
								)}
							</div>
							<div>
								<h1 className="font-bold text-2xl">{appointment.title}</h1>
							</div>
							<LabelBadges
								labels={appointment.labels.map((l) => l.label)}
								className="mt-2"
							/>
						</div>
					</div>

					<Section title={m.common_details()}>
						<div
							className={cn(
								"grid grid-cols-1 items-start gap-4",
								isHoliday ? "sm:grid-cols-2" : "sm:grid-cols-3",
							)}
						>
							<div>
								<div className="mb-1 text-muted-foreground text-xs uppercase">
									{m.appointments_start()}
								</div>
								<div>{formatDateTime(appointment.startDate)}</div>
							</div>
							<div>
								<div className="mb-1 text-muted-foreground text-xs uppercase">
									{m.appointments_end()}
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
										{m.appointments_location()}
									</div>
									{appointment.location ? (
										<Link
											href={createGoogleMapsLink(appointment.location)}
											external
										>
											{appointment.location}
										</Link>
									) : (
										<span className="text-muted-foreground">
											{m.appointments_no_location_set()}
										</span>
									)}
								</div>
							)}
							{appointment.ownTeam && (
								<div>
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{m.common_team()}
									</div>
									<Link
										to="/teams/$teamId"
										params={{ teamId: appointment.ownTeam.id }}
									>
										{appointment.ownTeam.title}
									</Link>
								</div>
							)}
						</div>

						{!isHoliday && appointment.location && (
							<div className="mt-4">
								<iframe
									src={`https://maps.google.com/maps?hl=de&t=&z=10&ie=UTF8&iwloc=B&output=embed&q=${appointment.location},+Deutschland`}
									className="h-64 w-full rounded-lg border border-border/40"
									title="Google Maps"
								/>
							</div>
						)}
					</Section>

					{!isHoliday && (
						<Section title={m.appointments_links()}>
							<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
								<div>
									<div className="mb-1 text-muted-foreground text-xs uppercase">
										{m.appointments_link()}
									</div>
									{appointment.link ? (
										<Link href={appointment.link} external>
											{appointment.link}
										</Link>
									) : (
										<span className="text-muted-foreground">
											{m.appointments_no_link_set()}
										</span>
									)}
								</div>
								<EditableNextAppointmentCard
									appointmentId={appointment.id}
									nextAppointmentId={appointment.nextAppointmentId}
									nextAppointment={appointment.nextAppointment}
									otherAppointments={appointments ?? []}
									canEdit={canEdit}
									onSave={(id) => onSaveField({ nextAppointmentId: id })}
								/>
							</div>
						</Section>
					)}

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
							{m.appointments_download_ical()}
						</Button>
						{canEdit && (
							<Button variant="outline" size="sm" onClick={onStartEdit}>
								{m.appointments_edit()}
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
								{m.appointments_cancel()}
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
				label={m.appointments_are_you_sure_you_want_to_delete_this_appointment()}
				open={isDeleting}
				onClose={onStopDeleting}
				onDelete={onDelete}
			/>

			<PlacementsSheet
				open={isParticipantsModalOpen}
				onClose={onCloseParticipants}
				canEdit={canEdit}
				placements={appointment.placements}
				players={players ?? []}
				appointmentId={appointment.id}
				categories={categories ?? []}
			/>

			<Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
				<SheetContent className="w-full sm:max-w-md">
					<SheetHeader>
						<SheetTitle>{m.appointments_edit_appointment()}</SheetTitle>
					</SheetHeader>
					<form
						id="edit-appointment"
						className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
						onSubmit={onSaveEdit}
					>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="title">{m.common_title()}</Label>
							<Input
								id="title"
								autoFocus
								value={draft.title}
								onChange={(e) => setDraft({ ...draft, title: e.target.value })}
							/>
						</fieldset>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="startDate">{m.appointments_startdate()}</Label>
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
							<Label htmlFor="endDate">{m.appointments_enddate()}</Label>
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
									<Label htmlFor="location">{m.appointments_location()}</Label>
									<Input
										id="location"
										value={draft.location}
										onChange={(e) =>
											setDraft({ ...draft, location: e.target.value })
										}
									/>
								</fieldset>
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor="link">{m.appointments_link()}</Label>
									<Input
										id="link"
										value={draft.link}
										onChange={(e) =>
											setDraft({ ...draft, link: e.target.value })
										}
									/>
								</fieldset>
								{/* isHoliday (above) covers HOLIDAY and TEAM_MATCH, so this
								    whole branch already excludes TEAM_MATCH — its season
								    stays derived from ownTeam, never editable here. */}
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor="season">{m.common_season()}</Label>
									<EntitySelect
										id="season"
										items={seasons}
										value={draft.seasonId}
										onValueChange={(value) =>
											setDraft({ ...draft, seasonId: value ?? "" })
										}
									/>
								</fieldset>
							</>
						)}
						{isTournament && (
							<fieldset className="flex flex-col gap-1.5">
								<Label>{m.labels_labels()}</Label>
								<LabelMultiSelect
									availableLabels={labels}
									selectedIds={draft.labelIds}
									onChange={(next) =>
										setDraft({ ...draft, labelIds: next.map((l) => l.id) })
									}
								/>
							</fieldset>
						)}
					</form>
					<SheetFooter>
						<div className="flex justify-end gap-2">
							<SheetClose render={<Button variant="secondary" />}>
								{m.appointments_cancel()}
							</SheetClose>
							<Button type="submit" form="edit-appointment">
								{m.common_save()}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}

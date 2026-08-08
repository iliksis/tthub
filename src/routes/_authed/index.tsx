import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CalendarDaysIcon,
	CheckIcon,
	MapPinIcon,
	UsersIcon,
	UsersRoundIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	createResponse,
	getNextAppointments,
	getUserAppointments,
	getUserOpenAppointments,
} from "@/api/appointments";
import { getPlayers } from "@/api/players";
import { getTeams } from "@/api/teams";
import { Card } from "@/components/appointments/Card";
import { PendingPile } from "@/components/appointments/PendingPile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import type { Appointment, Response } from "@/lib/prisma/client";
import type { ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/")({
	component: App,
	head: () => ({
		meta: [{ title: t("Dashboard") }],
	}),
	loader: async ({ context }) => {
		if (!context.user?.id) {
			throw new Error(t("Unauthorized"));
		}

		const promises = await Promise.all([
			getNextAppointments(),
			getUserAppointments({ data: { userId: context.user.id } }),
			getUserOpenAppointments({
				data: { userId: context.user.id },
			}),
			getPlayers(),
			getTeams(),
		]);

		const nextData = promises[0];
		const nextRes = await nextData.json();
		if (nextData.status >= 400) {
			throw new Error(nextRes.message);
		}

		const userData = promises[1];
		const userRes = await userData.json();
		if (userData.status >= 400) {
			throw new Error(userRes.message);
		}

		const openData = promises[2];
		const openRes = await openData.json();
		if (openData.status >= 400) {
			throw new Error(openRes.message);
		}

		const playersData = promises[3];
		const playersRes = await playersData.json();
		if (playersData.status >= 400) {
			throw new Error(playersRes.message);
		}

		const teamsData = promises[4];
		const teamsRes = await teamsData.json();
		if (teamsData.status >= 400) {
			throw new Error(teamsRes.message);
		}

		return {
			nextAppointments: nextRes.data,
			openAppointments: openRes.data,
			playerCount: playersRes.data?.length ?? 0,
			teamCount: teamsRes.data?.length ?? 0,
			userAppointments: userRes.data,
		};
	},
});

function App() {
	const {
		nextAppointments,
		userAppointments,
		openAppointments,
		playerCount,
		teamCount,
	} = Route.useLoaderData();
	const router = useRouter();
	const createResponseServerFn = useServerFn(createResponse);

	const onResponse =
		(appointmentId: string, response: ResponseType) => async () => {
			const res = await createResponseServerFn({
				data: { appointmentId, response },
			});
			const data = await res.json();
			if (res.status < 400 && data) {
				await router.invalidate();
				return;
			}
			toast.error(data.message);
		};

	const [next] = nextAppointments ?? [];

	const [initialPendingCount] = useState(openAppointments?.length ?? 0);
	const resolvedCount = initialPendingCount - (openAppointments?.length ?? 0);

	const upcoming = new Map<string, Appointment & { responses?: Response[] }>();
	for (const a of [
		...(nextAppointments ?? []),
		...(userAppointments ?? []),
		...(openAppointments ?? []),
	]) {
		upcoming.set(a.id, a);
	}
	const upcomingAppointments = [...upcoming.values()].sort(
		(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	);

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="flex flex-col gap-5 lg:hidden">
				<div className="flex gap-2">
					<div className="flex flex-1 items-center gap-2 rounded-xl bg-card px-3 py-2.5">
						<UsersIcon className="size-4 text-muted-foreground" />
						<span className="font-bold text-sm">{playerCount}</span>
						<span className="text-muted-foreground text-xs">
							{t("Players")}
						</span>
					</div>
					<div className="flex flex-1 items-center gap-2 rounded-xl bg-card px-3 py-2.5">
						<UsersRoundIcon className="size-4 text-muted-foreground" />
						<span className="font-bold text-sm">{teamCount}</span>
						<span className="text-muted-foreground text-xs">{t("Teams")}</span>
					</div>
				</div>

				<div>
					<div className="mb-2 flex items-center justify-between">
						<h2 className="font-bold text-sm">{t("Pending appointments")}</h2>
						{initialPendingCount > 0 && (
							<span className="text-muted-foreground text-xs">
								{t(
									"{0} of {1} answered",
									resolvedCount.toString(),
									initialPendingCount.toString(),
								)}
							</span>
						)}
					</div>
					<PendingPile
						appointments={openAppointments ?? []}
						onRespond={(appointmentId, response) =>
							onResponse(appointmentId, response)()
						}
					/>
				</div>

				<div className="flex flex-col gap-2.5">
					<h2 className="font-bold text-sm">{t("Upcoming appointments")}</h2>
					{upcomingAppointments.length > 0 ? (
						<div className="flex flex-col gap-2.5">
							{upcomingAppointments.map((a) => (
								<Card key={a.id} appointment={a} />
							))}
						</div>
					) : (
						<div className="rounded-xl bg-card px-4 py-6 text-center text-muted-foreground text-sm">
							{t("You have no appointments")}
						</div>
					)}
				</div>
			</div>

			{/* Desktop layout */}
			<div className="hidden lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
				<div className="flex min-w-0 flex-col gap-6">
					{next ? (
						<HeroCard appointment={next} onResponse={onResponse} />
					) : (
						<div className="rounded-xl bg-card p-6 text-muted-foreground">
							{t("No appointments in the next 4 weeks")}
						</div>
					)}
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<h3 className="flex-1 font-bold text-sm">
								{t("Your appointments")}
							</h3>
							{userAppointments && userAppointments.length > 0 && (
								<Badge variant="secondary">{userAppointments.length}</Badge>
							)}
						</div>
						{userAppointments && userAppointments.length > 0 ? (
							<div className="flex flex-col gap-3">
								{userAppointments.map((a) => (
									<Card key={a.id} appointment={a} />
								))}
							</div>
						) : (
							<div className="rounded-xl bg-card px-4 py-6 text-center text-muted-foreground text-sm">
								{t("You have no appointments")}
							</div>
						)}
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-6">
					<div className="rounded-xl bg-card p-4">
						<h3 className="mb-3 font-bold text-sm">{t("Club at a glance")}</h3>
						<div className="flex flex-col gap-2 text-sm">
							<div className="flex justify-between">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<UsersIcon className="size-4" /> {t("Players")}
								</span>
								<span className="font-bold">{playerCount}</span>
							</div>
							<div className="flex justify-between">
								<span className="flex items-center gap-1.5 text-muted-foreground">
									<UsersRoundIcon className="size-4" /> {t("Teams")}
								</span>
								<span className="font-bold">{teamCount}</span>
							</div>
						</div>
					</div>

					<div className="rounded-xl bg-card p-4">
						<div className="mb-3 flex items-center gap-2">
							<h3 className="flex-1 font-bold text-sm">
								{t("Pending appointments")}
							</h3>
							{openAppointments && openAppointments.length > 0 && (
								<Badge variant="warning">{openAppointments.length}</Badge>
							)}
						</div>
						{openAppointments && openAppointments.length > 0 ? (
							<div className="flex flex-col gap-3">
								{openAppointments.map((a) => (
									<PendingResponseItem
										key={a.id}
										appointment={a}
										onResponse={onResponse}
									/>
								))}
							</div>
						) : (
							<div className="text-muted-foreground text-sm">
								{t("You responded to all appointments")}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}

type HeroCardProps = {
	appointment: Appointment & { responses?: Response[] };
	onResponse: (
		appointmentId: string,
		response: ResponseType,
	) => () => Promise<void>;
};
const HeroCard = ({ appointment, onResponse }: HeroCardProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const userResponse = appointment.responses?.find(
		(r) => r.userId === user?.id,
	)?.responseType;
	const isAccepted = userResponse === "ACCEPT";
	const isDeclined = userResponse === "DECLINE";

	return (
		<div className="rounded-xl bg-card p-6">
			<div className="mb-2 text-xs font-bold uppercase tracking-wide">
				{t("Next Appointment")}
			</div>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="mb-2 font-bold text-2xl">
						<Link to={`/appts/$apptId`} params={{ apptId: appointment.id }}>
							{appointment.title}
						</Link>
					</h1>
					<div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
						<span className="flex items-center gap-1.5">
							<CalendarDaysIcon className="size-4" />
							{new Date(appointment.startDate).toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "short",
								year: "numeric",
							})}{" "}
							·{" "}
							{new Date(appointment.startDate).toLocaleTimeString("de-DE", {
								timeStyle: "short",
							})}
						</span>
						{appointment.location && (
							<span className="flex items-center gap-1.5">
								<MapPinIcon className="size-4" />
								{appointment.location}
							</span>
						)}
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border",
							isAccepted
								? "border-success bg-success text-success-foreground hover:bg-success/90"
								: "border-success/30 text-success hover:bg-success/15 hover:text-success",
						)}
						onClick={onResponse(appointment.id, "ACCEPT")}
					>
						{t("Accept")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border",
							isDeclined
								? "border-destructive bg-destructive text-white hover:bg-destructive/90"
								: "border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
						)}
						onClick={onResponse(appointment.id, "DECLINE")}
					>
						{t("Decline")}
					</Button>
				</div>
			</div>
		</div>
	);
};

type PendingResponseItemProps = {
	appointment: Appointment;
	onResponse: (
		appointmentId: string,
		response: ResponseType,
	) => () => Promise<void>;
};
const PendingResponseItem = ({
	appointment,
	onResponse,
}: PendingResponseItemProps) => {
	return (
		<div className="flex items-center gap-3 border-t border-border/40 pt-3 first:border-t-0 first:pt-0">
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium text-sm">{appointment.title}</div>
				<div className="text-muted-foreground text-xs">
					{new Date(appointment.startDate).toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					})}{" "}
					·{" "}
					{new Date(appointment.startDate).toLocaleTimeString("de-DE", {
						timeStyle: "short",
					})}
				</div>
			</div>
			<div className="flex shrink-0 gap-1.5">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="border border-success/30 text-success hover:bg-success/15 hover:text-success"
					title={t("Accept")}
					onClick={onResponse(appointment.id, "ACCEPT")}
				>
					<CheckIcon />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive"
					title={t("Decline")}
					onClick={onResponse(appointment.id, "DECLINE")}
				>
					<XIcon />
				</Button>
			</div>
		</div>
	);
};

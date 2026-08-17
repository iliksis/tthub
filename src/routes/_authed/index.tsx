import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { UsersIcon, UsersRoundIcon } from "lucide-react";
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
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { PendingPile } from "@/components/appointments/PendingPile";
import { Badge } from "@/components/ui/badge";
import type { Appointment, Response } from "@/lib/prisma/client";
import type { ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/")({
	component: App,
	head: () => ({
		meta: [{ title: t("Dashboard") }],
	}),
	loader: async ({ context }) => {
		if (!context.user?.id) {
			throw new Error(t("Unauthorized"));
		}

		const [nextRes, userRes, openRes, playersRes, teamsRes] = await Promise.all(
			[
				getNextAppointments(),
				getUserAppointments({ data: { userId: context.user.id } }),
				getUserOpenAppointments({
					data: { userId: context.user.id },
				}),
				getPlayers(),
				getTeams(),
			],
		);

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
			try {
				await createResponseServerFn({
					data: { appointmentId, response },
				});
				await router.invalidate();
			} catch (err) {
				toast.error((err as Error).message);
			}
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
								<AppointmentCard key={a.id} appointment={a} />
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
						<AppointmentCard
							appointment={next}
							size="lg"
							responseMode="actions"
							onRespond={(id, response) => onResponse(id, response)()}
						/>
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
									<AppointmentCard key={a.id} appointment={a} />
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
									<AppointmentCard
										key={a.id}
										appointment={a}
										size="sm"
										responseMode="actions"
										onRespond={(id, response) => onResponse(id, response)()}
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

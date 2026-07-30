import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDaysIcon, MapPinIcon } from "lucide-react";
import { toast } from "sonner";
import {
	createResponse,
	getNextAppointments,
	getUserAppointments,
	getUserAppointmentsWithoutResponses,
} from "@/api/appointments";
import { getPlayers } from "@/api/players";
import { getTeams } from "@/api/teams";
import { Card } from "@/components/appointments/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

		const promises = await Promise.all([
			getNextAppointments(),
			getUserAppointments({ data: { userId: context.user.id } }),
			getUserAppointmentsWithoutResponses({
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

		const withoutResponsesData = promises[2];
		const withoutResponsesRes = await withoutResponsesData.json();
		if (withoutResponsesData.status >= 400) {
			throw new Error(withoutResponsesRes.message);
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
			playerCount: playersRes.data?.length ?? 0,
			teamCount: teamsRes.data?.length ?? 0,
			userAppointments: userRes.data,
			withoutResponses: withoutResponsesRes.data,
		};
	},
});

function App() {
	const {
		nextAppointments,
		userAppointments,
		withoutResponses,
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

	const [hero, ...restNext] = nextAppointments ?? [];

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="flex flex-col gap-6 lg:hidden">
				<div className="flex flex-col gap-3">
					<div className="flex flex-row">
						<h2 className="font-bold flex-1">{t("Upcoming appointments")}</h2>
						{nextAppointments && (
							<Badge variant="secondary" className="shrink-0">
								{nextAppointments.length}
							</Badge>
						)}
					</div>
					{nextAppointments && nextAppointments.length > 0 ? (
						nextAppointments.map((a) => <Card key={a.id} appointment={a} />)
					) : (
						<div> {t("No appointments in the next 4 weeks")}</div>
					)}
				</div>
				<div className="flex flex-col gap-3">
					<div className="flex flex-row">
						<h2 className="font-bold flex-1"> {t("Your appointments")}</h2>
						{userAppointments && (
							<Badge variant="secondary" className="shrink-0">
								{userAppointments.length}
							</Badge>
						)}
					</div>
					{userAppointments && userAppointments.length > 0 ? (
						userAppointments.map((a) => <Card key={a.id} appointment={a} />)
					) : (
						<div>{t("You have no appointments")}</div>
					)}
				</div>
				<div className="flex flex-col gap-3">
					<div className="flex flex-row">
						<h2 className="font-bold flex-1">{t("Pending appointments")}</h2>
						{withoutResponses && (
							<Badge variant="secondary" className="shrink-0">
								{withoutResponses.length}
							</Badge>
						)}
					</div>
					{withoutResponses && withoutResponses.length > 0 ? (
						withoutResponses.map((a) => <Card key={a.id} appointment={a} />)
					) : (
						<div> {t("You responded to all appointments")}</div>
					)}
				</div>
			</div>

			{/* Desktop layout: next-match hero + side rail */}
			<div className="hidden lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
				<div className="flex min-w-0 flex-col gap-6">
					{hero ? (
						<HeroCard appointment={hero} onResponse={onResponse} />
					) : (
						<div className="rounded-xl bg-card p-6 text-muted-foreground">
							{t("No appointments in the next 4 weeks")}
						</div>
					)}
					<div className="flex flex-col gap-3">
						<div className="flex flex-row items-center gap-2">
							<h3 className="font-bold flex-1">{t("More appointments")}</h3>
							{restNext.length > 0 && (
								<Badge variant="secondary" className="shrink-0">
									{restNext.length}
								</Badge>
							)}
						</div>
						{restNext.length > 0 ? (
							restNext.map((a) => <Card key={a.id} appointment={a} />)
						) : (
							<div className="text-muted-foreground text-sm">
								{t("No appointments in the next 4 weeks")}
							</div>
						)}
					</div>
					<div className="flex flex-col gap-3">
						<div className="flex flex-row items-center gap-2">
							<h3 className="font-bold flex-1">{t("Your appointments")}</h3>
							{userAppointments && (
								<Badge variant="secondary" className="shrink-0">
									{userAppointments.length}
								</Badge>
							)}
						</div>
						{userAppointments && userAppointments.length > 0 ? (
							userAppointments.map((a) => <Card key={a.id} appointment={a} />)
						) : (
							<div className="text-muted-foreground text-sm">
								{t("You have no appointments")}
							</div>
						)}
					</div>
				</div>
				<div className="flex min-w-0 flex-col gap-6">
					<div className="rounded-xl bg-card p-4">
						<div className="mb-3 flex items-center gap-2">
							<h3 className="font-bold text-sm flex-1">
								{t("Pending appointments")}
							</h3>
							{withoutResponses && withoutResponses.length > 0 && (
								<Badge variant="warning" className="shrink-0">
									{withoutResponses.length}
								</Badge>
							)}
						</div>
						{withoutResponses && withoutResponses.length > 0 ? (
							<div className="flex flex-col gap-3">
								{withoutResponses.map((a) => (
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
					<div className="rounded-xl bg-card p-4">
						<h3 className="mb-3 font-bold text-sm">{t("Club at a glance")}</h3>
						<div className="flex flex-col gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">{t("Players")}</span>
								<span className="font-bold">{playerCount}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">{t("Teams")}</span>
								<span className="font-bold">{teamCount}</span>
							</div>
						</div>
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
	return (
		<div className="rounded-xl bg-card p-6">
			<div className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
				{t("Next Appointment")}
			</div>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<h1 className="mb-2 font-bold text-2xl">{appointment.title}</h1>
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
						className="border border-success/30 text-success hover:bg-success/15 hover:text-success"
						onClick={onResponse(appointment.id, "ACCEPT")}
					>
						{t("Accept")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className="border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning"
						onClick={onResponse(appointment.id, "MAYBE")}
					>
						{t("Maybe")}
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
					✓
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive"
					title={t("Decline")}
					onClick={onResponse(appointment.id, "DECLINE")}
				>
					✕
				</Button>
			</div>
		</div>
	);
};

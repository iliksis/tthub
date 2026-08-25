import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	GlobeIcon,
	PartyPopperIcon,
	TrophyIcon,
	UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
	createResponse,
	getNextAppointments,
	getRecentTransactions,
	getUserOpenAppointments,
} from "@/api/appointments";
import { getPlayers } from "@/api/players";
import { getTeams } from "@/api/teams";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { transactionActionBadge } from "@/lib/transactionLabels";
import { cn, formatRelativeTime } from "@/lib/utils";

const RECENT_ACTIVITY_TAKE = 5;

const dateFmt = (d: Date | string) =>
	new Date(d).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "short",
		weekday: "short",
	});
const openDateFmt = (d: Date | string) =>
	new Date(d).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "short",
	});
const timeFmt = (d: Date | string) =>
	new Date(d).toLocaleTimeString("de-DE", { timeStyle: "short" });
const isMultiDay = (startDate: Date | string, endDate: Date | string | null) =>
	endDate !== null &&
	new Date(startDate).toDateString() !== new Date(endDate).toDateString();
const rangeFmt = (startDate: Date | string, endDate: Date | string | null) =>
	isMultiDay(startDate, endDate) && endDate
		? `${openDateFmt(startDate)}-${openDateFmt(endDate)}`
		: dateFmt(startDate);
const shortRangeFmt = (
	startDate: Date | string,
	endDate: Date | string | null,
) =>
	isMultiDay(startDate, endDate) && endDate
		? `${new Date(startDate).getDate()}.-${openDateFmt(endDate)}`
		: dateFmt(startDate);
const typeIcon: Record<AppointmentType, typeof TrophyIcon> = {
	HOLIDAY: PartyPopperIcon,
	TEAM_MATCH: UsersIcon,
	TOURNAMENT: TrophyIcon,
	TOURNAMENT_DE: GlobeIcon,
};

export const Route = createFileRoute("/_authed/")({
	component: App,
	head: () => ({
		meta: [{ title: t("Dashboard") }],
	}),
	loader: async ({ context }) => {
		if (!context.user?.id) {
			throw new Error(t("Unauthorized"));
		}

		const [nextRes, openRes, playersRes, teamsRes, transactionsRes] =
			await Promise.all([
				getNextAppointments(),
				getUserOpenAppointments({
					data: { userId: context.user.id },
				}),
				getPlayers(),
				getTeams(),
				getRecentTransactions({ data: { take: RECENT_ACTIVITY_TAKE } }),
			]);

		return {
			nextAppointments: nextRes.data,
			openAppointments: openRes.data,
			playerCount: playersRes.data?.length ?? 0,
			recentActivity: transactionsRes.data ?? [],
			teams: teamsRes.data ?? [],
		};
	},
});

function App() {
	const { nextAppointments, openAppointments, teams, recentActivity } =
		Route.useLoaderData();
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

	return (
		<div className="flex flex-col gap-8">
			<div>
				<h1 className="font-bold text-lg hidden lg:block">{t("Dashboard")}</h1>
			</div>

			<div className="grid gap-10 lg:grid-cols-[1fr_340px]">
				<div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2">
					<Section title={t("Upcoming appointments")}>
						{nextAppointments.length > 0 ? (
							<>
								<table className="hidden w-full border-collapse text-sm lg:table">
									<tbody>
										{nextAppointments.map((a) => {
											const TypeIcon = typeIcon[a.type];
											return (
												<tr key={a.id} className="border-border/60 border-b">
													<td className="w-32 py-2.5 text-muted-foreground">
														{rangeFmt(a.startDate, a.endDate)}
													</td>
													<td className="w-16 py-2.5 text-muted-foreground">
														{timeFmt(a.startDate)}
													</td>
													<td className="py-2.5 font-medium">
														<Link to="/appts/$apptId" params={{ apptId: a.id }}>
															{a.shortTitle}
														</Link>
													</td>
													<td className="py-2.5 text-right text-muted-foreground">
														{a.location}
													</td>
													<td className="w-8 py-2.5 text-right">
														<TypeIcon className="ml-auto size-3.5 text-muted-foreground" />
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
								<div className="flex flex-col lg:hidden">
									{nextAppointments.map((a) => {
										const TypeIcon = typeIcon[a.type];
										return (
											<div
												key={a.id}
												className="flex items-center gap-2.5 border-border/60 border-b py-2.5 text-sm last:border-b-0"
											>
												<TypeIcon className="size-3.5 shrink-0 text-muted-foreground" />
												<span className="w-20 shrink-0 text-muted-foreground text-xs">
													{shortRangeFmt(a.startDate, a.endDate)}
												</span>
												<span className="w-10 shrink-0 text-muted-foreground text-xs">
													{timeFmt(a.startDate)}
												</span>
												<Link
													to="/appts/$apptId"
													params={{ apptId: a.id }}
													className="min-w-0 flex-1 truncate font-medium"
												>
													{a.shortTitle}
												</Link>
											</div>
										);
									})}
								</div>
							</>
						) : (
							<div className="text-muted-foreground text-sm">
								{t("You have no appointments")}
							</div>
						)}
					</Section>
				</div>

				<div className="min-w-0 lg:col-start-2 lg:row-start-1">
					<Section title={t("Pending appointments")}>
						{openAppointments && openAppointments.length > 0 ? (
							<div className="flex flex-col">
								{openAppointments.map((a) => (
									<div
										key={a.id}
										className="flex items-center justify-between gap-2 border-border/60 border-b py-2 text-sm"
									>
										<div className="flex min-w-0 items-center gap-2">
											<span className="shrink-0 text-muted-foreground text-xs">
												{openDateFmt(a.startDate)}
											</span>
											<Link
												to="/appts/$apptId"
												params={{ apptId: a.id }}
												className="min-w-0 truncate"
											>
												{a.shortTitle}
											</Link>
										</div>
										<div className="flex shrink-0 gap-1">
											<Button
												size="xs"
												variant="outline"
												className="border-success/30 text-success hover:bg-success/15"
												onClick={onResponse(a.id, "ACCEPT")}
											>
												{t("Accept")}
											</Button>
											<Button
												size="xs"
												variant="outline"
												className="border-destructive/30 text-destructive hover:bg-destructive/15"
												onClick={onResponse(a.id, "DECLINE")}
											>
												{t("Decline")}
											</Button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-muted-foreground text-sm">
								{t("You responded to all appointments")}
							</div>
						)}
					</Section>
				</div>

				<div className="min-w-0 lg:col-start-2 lg:row-start-2">
					<Section title={t("Recent activity")}>
						{recentActivity.length > 0 ? (
							<div className="flex flex-col gap-2.5">
								{recentActivity.map((tx) => {
									const badge = transactionActionBadge(tx.type);
									return (
										<div
											key={tx.id}
											className="flex items-center gap-2 text-xs"
										>
											<Badge
												variant={badge.variant}
												inverted
												className="shrink-0"
											>
												{badge.label}
											</Badge>
											<span className="min-w-0 flex-1 truncate text-muted-foreground">
												<span className="font-medium text-foreground">
													{tx.user?.name ?? "—"}
												</span>{" "}
												·{" "}
												<Link
													to="/appts/$apptId"
													params={{ apptId: tx.appointment.id }}
												>
													{tx.appointment.shortTitle}
												</Link>
											</span>
											<span className="shrink-0 text-muted-foreground">
												{formatRelativeTime(tx.createdAt)}
											</span>
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-muted-foreground text-sm">—</div>
						)}
					</Section>
				</div>
			</div>

			<Section title={t("Standings")}>
				<div className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
					{teams.map((team, i) => (
						<div
							key={team.id}
							className={cn(
								"min-w-0",
								i > 0 &&
									"border-border/60 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8",
							)}
						>
							<div className="mb-2 flex items-baseline justify-between gap-2">
								<Link
									to="/teams/$teamId"
									params={{ teamId: team.id }}
									className="font-medium text-sm"
								>
									{team.title}
								</Link>
								<span className="text-muted-foreground text-xs">
									{team.league}
								</span>
							</div>
							{team.standings.length > 0 ? (
								<table className="w-full border-collapse text-sm">
									<tbody>
										{team.standings.map((s) => (
											<tr key={s.id} className="border-border/40 border-b">
												<td className="w-5 py-1.5 text-muted-foreground">
													{s.rank}
												</td>
												<td className="truncate py-1.5">{s.teamName}</td>
												<td className="py-1.5 text-right">{s.pointsWon}</td>
											</tr>
										))}
									</tbody>
								</table>
							) : (
								<div className="text-muted-foreground text-xs">
									{t("No standings imported yet.")}
								</div>
							)}
						</div>
					))}
				</div>
			</Section>
		</div>
	);
}

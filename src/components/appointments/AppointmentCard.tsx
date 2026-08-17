import { Link as TanstackLink, useRouteContext } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	CheckIcon,
	GlobeIcon,
	MapPinIcon,
	PartyPopperIcon,
	TrophyIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import type { Appointment, Response } from "@/lib/prisma/client";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

const typeIcon: Record<AppointmentType, typeof TrophyIcon> = {
	HOLIDAY: PartyPopperIcon,
	TEAM_MATCH: UsersIcon,
	TOURNAMENT: TrophyIcon,
	TOURNAMENT_DE: GlobeIcon,
};

const typeBg: Record<AppointmentType, string> = {
	HOLIDAY: "bg-primary/15 text-primary",
	TEAM_MATCH: "bg-warning/15 text-warning",
	TOURNAMENT: "bg-success/15 text-success",
	TOURNAMENT_DE: "bg-info/15 text-info",
};

const formatWeekday = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", { weekday: "short" });
const formatDay = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", { day: "2-digit" });
const formatMonth = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", { month: "short" });
const formatTime = (date: Date | string) =>
	new Date(date).toLocaleTimeString("de-DE", { timeStyle: "short" });
const formatFullDate = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
const shortDate = (date: Date | string) =>
	`${formatWeekday(date)}, ${formatDay(date)}. ${formatMonth(date)}`;

export type AppointmentCardSize = "sm" | "md" | "lg";
export type AppointmentCardResponseMode = "badge" | "actions" | "none";

type AppointmentCardProps = {
	appointment: Appointment & { responses?: Response[] };
	size?: AppointmentCardSize;
	responseMode?: AppointmentCardResponseMode;
	onRespond?: (appointmentId: string, response: ResponseType) => void;
};

// Standardized appointment card: replaces Card.tsx (list rows), the dashboard
// HeroCard (size="lg"), and PendingResponseItem (size="sm" responseMode="actions").
// A leading type icon carries the appointment category everywhere instead of a
// date-tile, so date/time/location always live in the text line.
export const AppointmentCard = ({
	appointment,
	size = "md",
	responseMode = "badge",
	onRespond,
}: AppointmentCardProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const userResponse = appointment.responses?.find(
		(r) => r.userId === user?.id,
	)?.responseType;
	const isAccepted = userResponse === "ACCEPT";
	const isDeclined = userResponse === "DECLINE";
	const Icon = typeIcon[appointment.type];

	const responseControl = (iconSize: "icon-xs" | "icon-sm" = "icon-sm") => {
		if (responseMode === "none") return null;
		if (responseMode === "badge") {
			return (
				<Badge
					variant={
						isAccepted ? "success" : isDeclined ? "destructive" : "warning"
					}
					className="shrink-0"
				>
					{isAccepted ? t("Accepted") : isDeclined ? t("Declined") : t("Maybe")}
				</Badge>
			);
		}
		return (
			<div className="flex shrink-0 gap-1.5">
				<Button
					type="button"
					variant="ghost"
					size={iconSize}
					title={t("Accept")}
					className={cn(
						"border border-success/30 text-success hover:bg-success/15 hover:text-success",
						isAccepted &&
							"border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground",
					)}
					onClick={() => onRespond?.(appointment.id, "ACCEPT")}
				>
					<CheckIcon />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size={iconSize}
					title={t("Decline")}
					className={cn(
						"border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
						isDeclined &&
							"border-destructive bg-destructive text-white hover:bg-destructive/90",
					)}
					onClick={() => onRespond?.(appointment.id, "DECLINE")}
				>
					<XIcon />
				</Button>
			</div>
		);
	};

	if (size === "lg") {
		return (
			<div className="rounded-xl bg-card p-6">
				<div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wide">
					<Icon className="size-4" />
					{t("Next Appointment")}
				</div>
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div className="min-w-0">
						<h1 className="mb-2 font-bold text-2xl">
							<Link to="/appts/$apptId" params={{ apptId: appointment.id }}>
								{appointment.title}
							</Link>
						</h1>
						<div className="flex flex-wrap gap-4 text-muted-foreground text-sm">
							<span className="flex items-center gap-1.5">
								<CalendarDaysIcon className="size-4" />
								{formatFullDate(appointment.startDate)} ·{" "}
								{formatTime(appointment.startDate)}
							</span>
							{appointment.location && (
								<span className="flex items-center gap-1.5">
									<MapPinIcon className="size-4" />
									{appointment.location}
								</span>
							)}
						</div>
					</div>
					{responseMode === "actions" && (
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
								onClick={() => onRespond?.(appointment.id, "ACCEPT")}
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
								onClick={() => onRespond?.(appointment.id, "DECLINE")}
							>
								{t("Decline")}
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	const iconClass = size === "sm" ? "size-7" : "size-10";
	const iconGlyphClass = size === "sm" ? "size-3.5" : "size-4.5";
	const content = (
		<>
			<div
				className={cn(
					"flex shrink-0 items-center justify-center rounded-full",
					iconClass,
					typeBg[appointment.type],
				)}
			>
				<Icon className={iconGlyphClass} />
			</div>
			<div className="min-w-0 flex-1">
				{size === "sm" ? (
					<div className="truncate font-medium text-sm">
						{appointment.title}
					</div>
				) : (
					<h3 className="overflow-hidden text-ellipsis whitespace-nowrap font-bold">
						{appointment.title}
					</h3>
				)}
				<div
					className={cn(
						"truncate text-muted-foreground",
						size === "sm" ? "text-xs" : "text-sm",
					)}
				>
					{shortDate(appointment.startDate)} ·{" "}
					{formatTime(appointment.startDate)}
					{appointment.location && ` · ${appointment.location}`}
				</div>
			</div>
			{responseControl(size === "sm" ? "icon-xs" : "icon-sm")}
		</>
	);

	if (responseMode === "actions") {
		return (
			<div
				className={cn(
					"flex items-center gap-2.5 rounded-lg bg-card",
					size === "sm" ? "px-2.5 py-2" : "gap-3 rounded-xl p-3.5",
				)}
			>
				{content}
			</div>
		);
	}

	return (
		<TanstackLink
			to="/appts/$apptId"
			params={{ apptId: appointment.id }}
			className={cn(
				"flex items-center gap-2.5 rounded-lg bg-card",
				size === "sm" ? "px-2.5 py-2" : "gap-3 rounded-xl p-3.5 shadow-sm",
			)}
		>
			{content}
		</TanstackLink>
	);
};

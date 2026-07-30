import { Link, useRouteContext } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import type { Appointment, Response } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type CardProps = {
	appointment: Appointment & { responses?: Response[] };
};
export const Card = ({ appointment }: CardProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const userResponse =
		appointment.responses?.find((r) => r.userId === user?.id)?.responseType ??
		"MAYBE";
	const isAccepted = userResponse === "ACCEPT";
	const isDeclined = userResponse === "DECLINE";

	const month = new Date(appointment.startDate).toLocaleDateString("de-DE", {
		month: "short",
	});
	const day = new Date(appointment.startDate).toLocaleDateString("de-DE", {
		day: "2-digit",
	});
	const time = new Date(appointment.startDate).toLocaleTimeString("de-DE", {
		timeStyle: "short",
	});

	return (
		<Link
			to="/appts/$apptId"
			params={{ apptId: appointment.id }}
			className="flex flex-row items-center gap-3.5 rounded-xl bg-card p-4 text-card-foreground shadow-sm"
		>
			<div className="size-12 flex flex-col items-center justify-center shrink-0 bg-muted rounded-lg">
				<span className="uppercase text-xs">{month}</span>
				<span className="font-bold">{day}</span>
			</div>
			<div className="flex-1 min-w-0">
				<h3 className="font-bold mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
					{appointment.title}
				</h3>
				<div className="flex gap-2 flex-nowrap whitespace-nowrap">
					<span className="flex items-center gap-1">{time}</span>-
					<span className="flex items-center gap-1 overflow-hidden text-ellipsis">
						{appointment.location}
					</span>
				</div>
			</div>
			<div className="flex items-center justify-center shrink-0">
				<Badge
					variant={
						isAccepted ? "success" : isDeclined ? "destructive" : "warning"
					}
				>
					{isAccepted
						? t("Accepted")
						: isDeclined
							? t("Declined")
							: t("Maybe")}
				</Badge>
			</div>
		</Link>
	);
};

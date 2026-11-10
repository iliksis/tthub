import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { AuditLogPageEntry } from "@/api/auditLog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	auditActionBadge,
	fieldLabel,
	formatChangeValue,
} from "@/lib/auditLabels";
import type { AuditChanges } from "@/lib/auditLog";
import {
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

const dateTimeFormat: Intl.DateTimeFormatOptions = {
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	month: "short",
	year: "numeric",
};

type AuditEntryDetailProps = {
	entry: AuditLogPageEntry;
};

export const AuditEntryDetail = ({ entry }: AuditEntryDetailProps) => {
	const userColor = entry.user ? createColorForUserId(entry.user.id) : null;
	const badge = auditActionBadge(entry.action);
	const changes = entry.changes as AuditChanges | null;
	const entries = Object.entries(changes ?? {});
	const isAppointment = entry.entityType === "Appointment";

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<span className="font-bold text-sm">{m.common_details()}</span>
				<Badge variant={badge.variant}>{badge.label}</Badge>
			</div>
			<div>
				<div className="font-medium text-sm">{entry.entity.name}</div>
				{(entry.entity.detail || isAppointment) && (
					<div className="text-muted-foreground text-xs">
						{entry.entity.detail ?? m.appointments_no_location_set()}
					</div>
				)}
			</div>
			<div className="flex items-center gap-2 text-sm">
				{entry.user && userColor ? (
					<>
						<Avatar size="sm" className="shrink-0">
							<AvatarFallback
								style={{
									backgroundColor: userColor.backgroundColor,
									color: userColor.foregroundColor,
								}}
							>
								{shortenUserName(entry.user.name)}
							</AvatarFallback>
						</Avatar>
						<span>{entry.user.name}</span>
					</>
				) : (
					<span className="text-muted-foreground">
						{m.appointments_deleted_user()}
					</span>
				)}
			</div>
			<Tooltip>
				<TooltipTrigger
					render={<div className="w-fit text-muted-foreground text-xs" />}
				>
					{formatRelativeTime(entry.createdAt)}
				</TooltipTrigger>
				<TooltipContent>
					{new Date(entry.createdAt).toLocaleString("de-DE", dateTimeFormat)}
				</TooltipContent>
			</Tooltip>
			{entries.length > 0 && (
				<dl className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-2.5 text-xs">
					{entries.map(([field, change]) => (
						<div key={field} className="flex flex-wrap items-center gap-1.5">
							<dt className="font-medium text-foreground">
								{fieldLabel(entry.entityType, field)}:
							</dt>
							<dd className="flex items-center gap-1.5 text-muted-foreground">
								<span className="line-through decoration-destructive/50">
									{formatChangeValue(entry.entityType, field, change.old)}
								</span>
								<span aria-hidden="true">→</span>
								<span className="text-foreground">
									{formatChangeValue(entry.entityType, field, change.new)}
								</span>
							</dd>
						</div>
					))}
				</dl>
			)}
			{isAppointment && (
				<Button
					variant="outline"
					size="sm"
					className="mt-1 w-fit"
					render={
						<Link to="/appts/$apptId" params={{ apptId: entry.entityId }} />
					}
				>
					<ExternalLinkIcon className="size-3.5" />
					{m.appointments_open_appointment()}
				</Button>
			)}
		</div>
	);
};

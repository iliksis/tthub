import type { AuditEntry } from "@/api/auditLog";
import { Section } from "@/components/Section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { fieldLabel } from "@/lib/auditLabels";
import type { AuditChanges } from "@/lib/auditLog";
import { AuditAction } from "@/lib/prisma/enums";
import {
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

type AuditHistoryProps = {
	entries: AuditEntry[];
};

const dateTimeFormat: Intl.DateTimeFormatOptions = {
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	month: "short",
	year: "numeric",
};

type HistoryEntry = {
	key: string;
	header: string;
	user: AuditEntry["user"];
	createdAt: Date;
};

const buildEntries = (auditEntries: AuditEntry[]): HistoryEntry[] => {
	const entries: HistoryEntry[] = [];
	for (const entry of auditEntries) {
		if (entry.action === AuditAction.CREATE) {
			entries.push({
				createdAt: entry.createdAt,
				header: m.appointments_appointment_created(),
				key: entry.id,
				user: entry.user,
			});
		} else if (entry.action === AuditAction.DELETE) {
			entries.push({
				createdAt: entry.createdAt,
				header: m.appointments_appointment_deleted(),
				key: entry.id,
				user: entry.user,
			});
		} else if (entry.action === AuditAction.RESTORE) {
			entries.push({
				createdAt: entry.createdAt,
				header: m.appointments_appointment_restored(),
				key: entry.id,
				user: entry.user,
			});
		} else {
			const changes = entry.changes as AuditChanges | null;
			const fields = Object.keys(changes ?? {});
			if (fields.length > 0) {
				const labels = fields.map((field) =>
					fieldLabel(entry.entityType, field),
				);
				entries.push({
					createdAt: entry.createdAt,
					header: m.appointments_n_changed({ param1: labels.join(", ") }),
					key: entry.id,
					user: entry.user,
				});
			}
		}
	}
	return entries;
};

export const AuditHistory = ({ entries: auditEntries }: AuditHistoryProps) => {
	const entries = buildEntries(auditEntries);
	if (entries.length === 0) return null;

	return (
		<Section title={m.common_history()}>
			<ul className="flex flex-col gap-3">
				{entries.map((entry) => {
					const userColor = entry.user
						? createColorForUserId(entry.user.id)
						: null;
					return (
						<li key={entry.key} className="flex gap-2 text-sm">
							<Avatar size="sm" className="shrink-0">
								<AvatarFallback
									style={
										userColor
											? {
													backgroundColor: userColor.backgroundColor,
													color: userColor.foregroundColor,
												}
											: undefined
									}
								>
									{entry.user ? shortenUserName(entry.user.name) : "?"}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p>{entry.header}</p>
								<p className="text-muted-foreground text-xs">
									{entry.user ? entry.user.name : m.appointments_deleted_user()}{" "}
									·{" "}
									<Tooltip>
										<TooltipTrigger render={<span />}>
											{formatRelativeTime(entry.createdAt)}
										</TooltipTrigger>
										<TooltipContent>
											{new Date(entry.createdAt).toLocaleString(
												"de-DE",
												dateTimeFormat,
											)}
										</TooltipContent>
									</Tooltip>
								</p>
							</div>
						</li>
					);
				})}
			</ul>
		</Section>
	);
};

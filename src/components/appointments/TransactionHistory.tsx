import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Transaction, User } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { createColorForUserId, shortenUserName } from "@/lib/utils";

type TransactionChanges = Record<string, { old: unknown; new: unknown }>;

type TransactionHistoryProps = {
	transactions: (Transaction & { user: User })[];
};

const fieldLabels: Record<string, string> = {
	endDate: t("EndDate"),
	link: t("Link"),
	location: t("Location"),
	nextAppointmentId: t("Next Appointment"),
	shortTitle: t("ShortTitle"),
	startDate: t("StartDate"),
	status: t("Status"),
	title: t("Title"),
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
	user: User;
	createdAt: Date;
};

const buildEntries = (
	transactions: (Transaction & { user: User })[],
): HistoryEntry[] => {
	const entries: HistoryEntry[] = [];
	for (const transaction of transactions) {
		if (transaction.type === TransactionType.CREATE) {
			entries.push({
				createdAt: transaction.createdAt,
				header: t("Appointment created"),
				key: transaction.id,
				user: transaction.user,
			});
		} else if (transaction.type === TransactionType.DELETE) {
			entries.push({
				createdAt: transaction.createdAt,
				header: t("Appointment deleted"),
				key: transaction.id,
				user: transaction.user,
			});
		} else {
			const changes = transaction.changes as TransactionChanges | null;
			const fields = Object.keys(changes ?? {});
			if (fields.length > 0) {
				const labels = fields.map((field) => fieldLabels[field] ?? field);
				entries.push({
					createdAt: transaction.createdAt,
					header: t("{0} changed", labels.join(", ")),
					key: transaction.id,
					user: transaction.user,
				});
			}
		}
	}
	return entries;
};

export const TransactionHistory = ({
	transactions,
}: TransactionHistoryProps) => {
	const entries = buildEntries(transactions);
	if (entries.length === 0) return null;

	return (
		<div className="rounded-lg bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="font-bold text-sm">{t("History")}</span>
			</div>
			<ul className="flex flex-col gap-3">
				{entries.map((entry) => {
					const userColor = createColorForUserId(entry.user.id);
					return (
						<li key={entry.key} className="flex gap-2 text-sm">
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
							<div className="min-w-0 flex-1">
								<p>{entry.header}</p>
								<p className="text-muted-foreground text-xs">
									{entry.user.name} ·{" "}
									{new Date(entry.createdAt).toLocaleString(
										"de-DE",
										dateTimeFormat,
									)}
								</p>
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
};

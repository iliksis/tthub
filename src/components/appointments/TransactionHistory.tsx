import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Transaction, User } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { fieldLabels, type TransactionChanges } from "@/lib/transactionLabels";
import {
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";

type TransactionHistoryProps = {
	transactions: (Transaction & { user: User | null })[];
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
	user: User | null;
	createdAt: Date;
};

const buildEntries = (
	transactions: (Transaction & { user: User | null })[],
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
		} else if (transaction.type === TransactionType.RESTORE) {
			entries.push({
				createdAt: transaction.createdAt,
				header: t("Appointment restored"),
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
									{entry.user ? entry.user.name : t("Deleted user")} ·{" "}
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
		</div>
	);
};

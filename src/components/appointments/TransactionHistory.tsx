import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Appointment, Transaction, User } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { createColorForUserId, shortenUserName } from "@/lib/utils";

type TransactionChanges = Record<string, { old: unknown; new: unknown }>;

type TransactionHistoryProps = {
	transactions: (Transaction & { user: User })[];
	otherAppointments: Appointment[];
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

const formatChangeValue = (
	field: string,
	value: unknown,
	otherAppointments: Appointment[],
) => {
	if (value === null || value === undefined || value === "") return "–";
	if (field === "startDate" || field === "endDate") {
		return new Date(value as string).toLocaleDateString(
			"de-DE",
			dateTimeFormat,
		);
	}
	if (field === "nextAppointmentId") {
		return (
			otherAppointments.find((a) => a.id === value)?.title ?? String(value)
		);
	}
	return String(value);
};

const actionSentence = (type: TransactionType, userName: string) => {
	switch (type) {
		case TransactionType.CREATE:
			return t("{0} created this appointment", userName);
		case TransactionType.DELETE:
			return t("{0} deleted this appointment", userName);
		default:
			return t("{0} updated this appointment", userName);
	}
};

export const TransactionHistory = ({
	transactions,
	otherAppointments,
}: TransactionHistoryProps) => {
	if (transactions.length === 0) return null;

	return (
		<div className="rounded-lg bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="font-bold text-sm">{t("History")}</span>
			</div>
			<ul className="flex flex-col gap-3">
				{transactions.map((transaction) => {
					const userColor = createColorForUserId(transaction.userId);
					const changes = transaction.changes as TransactionChanges | null;
					return (
						<li key={transaction.id} className="flex gap-2 text-sm">
							<Avatar size="sm" className="shrink-0">
								<AvatarFallback
									style={{
										backgroundColor: userColor.backgroundColor,
										color: userColor.foregroundColor,
									}}
								>
									{shortenUserName(transaction.user.name)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<p>
									{actionSentence(transaction.type, transaction.user.name)}{" "}
									<span className="text-muted-foreground text-xs">
										{new Date(transaction.createdAt).toLocaleString(
											"de-DE",
											dateTimeFormat,
										)}
									</span>
								</p>
								{changes && (
									<ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground text-xs">
										{Object.entries(changes).map(([field, change]) => (
											<li key={field}>
												{fieldLabels[field] ?? field}:{" "}
												{formatChangeValue(
													field,
													change.old,
													otherAppointments,
												)}{" "}
												→{" "}
												{formatChangeValue(
													field,
													change.new,
													otherAppointments,
												)}
											</li>
										))}
									</ul>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
};

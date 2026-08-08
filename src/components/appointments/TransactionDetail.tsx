import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Appointment, Transaction, User } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import {
	fieldLabels,
	formatChangeValue,
	type TransactionChanges,
	transactionActionBadge,
} from "@/lib/transactionLabels";
import {
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";

const dateTimeFormat: Intl.DateTimeFormatOptions = {
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	month: "short",
	year: "numeric",
};

type TransactionDetailProps = {
	transaction: Transaction & { user: User | null; appointment: Appointment };
};

export const TransactionDetail = ({ transaction }: TransactionDetailProps) => {
	const userColor = transaction.user
		? createColorForUserId(transaction.user.id)
		: null;
	const badge = transactionActionBadge(transaction.type);
	const changes = transaction.changes as TransactionChanges | null;
	const entries = Object.entries(changes ?? {});

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<span className="font-bold text-sm">{t("Details")}</span>
				<Badge variant={badge.variant}>{badge.label}</Badge>
			</div>
			<div>
				<div className="font-medium text-sm">
					{transaction.appointment.title}
				</div>
				<div className="text-muted-foreground text-xs">
					{transaction.appointment.location ?? t("No location set")}
				</div>
			</div>
			<div className="flex items-center gap-2 text-sm">
				{transaction.user && userColor ? (
					<>
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
						<span>{transaction.user.name}</span>
					</>
				) : (
					<span className="text-muted-foreground">{t("Deleted user")}</span>
				)}
			</div>
			<Tooltip>
				<TooltipTrigger
					render={<div className="w-fit text-muted-foreground text-xs" />}
				>
					{formatRelativeTime(transaction.createdAt)}
				</TooltipTrigger>
				<TooltipContent>
					{new Date(transaction.createdAt).toLocaleString(
						"de-DE",
						dateTimeFormat,
					)}
				</TooltipContent>
			</Tooltip>
			{entries.length > 0 && (
				<dl className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-2.5 text-xs">
					{entries.map(([field, change]) => (
						<div key={field} className="flex flex-wrap items-center gap-1.5">
							<dt className="font-medium text-foreground">
								{fieldLabels[field] ?? field}:
							</dt>
							<dd className="flex items-center gap-1.5 text-muted-foreground">
								<span className="line-through decoration-destructive/50">
									{formatChangeValue(field, change.old)}
								</span>
								<span aria-hidden="true">→</span>
								<span className="text-foreground">
									{formatChangeValue(field, change.new)}
								</span>
							</dd>
						</div>
					))}
				</dl>
			)}
			<Button
				variant="outline"
				size="sm"
				className="mt-1 w-fit"
				render={
					<Link
						to="/appts/$apptId"
						params={{ apptId: transaction.appointment.id }}
					/>
				}
			>
				<ExternalLinkIcon className="size-3.5" />
				{t("Open appointment")}
			</Button>
		</div>
	);
};

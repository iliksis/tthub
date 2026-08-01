import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Appointment, Transaction, User } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import {
	getChangedFields,
	type TransactionChanges,
	transactionActionBadge,
} from "@/lib/transactionLabels";
import {
	cn,
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";

type JournalMobileRowProps = {
	transaction: Transaction & { user: User; appointment: Appointment };
	isSelected: boolean;
	isNew: boolean;
	onClick: () => void;
};

export const JournalMobileRow = ({
	transaction,
	isSelected,
	isNew,
	onClick,
}: JournalMobileRowProps) => {
	const userColor = createColorForUserId(transaction.user.id);
	const badge = transactionActionBadge(transaction.type);
	const fields = getChangedFields(
		transaction.changes as TransactionChanges | null,
	);
	const changedSummary =
		fields.length > 0 ? t("{0} fields changed", fields.length.toString()) : "—";

	return (
		<button
			type="button"
			data-testid="journal-row"
			onClick={onClick}
			className={cn(
				"flex  w-full flex-col gap-1.5 border-border/60 border-b py-3.5 px-3 text-left first:rounded-t-lg last:border-b-0 last:rounded-b-lg",
				isSelected && "bg-muted",
				isNew && "fade-in slide-in-from-top-1 animate-in duration-200 ease-out",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
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
					<span className="truncate text-sm">{transaction.user.name}</span>
				</div>
				<span className="shrink-0 text-muted-foreground text-xs">
					{formatRelativeTime(transaction.createdAt)}
				</span>
			</div>
			<div className="flex items-center justify-between gap-2 pl-8">
				<span className="truncate font-medium text-primary text-sm">
					{transaction.appointment.shortTitle}
				</span>
				<Badge variant={badge.variant} className="shrink-0">
					{badge.label}
				</Badge>
			</div>
			<div className="pl-8 text-muted-foreground text-xs">{changedSummary}</div>
		</button>
	);
};

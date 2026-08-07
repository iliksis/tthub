import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { t } from "@/lib/text";
import { formatRelativeTime } from "@/lib/utils";

const dateTimeFormat: Intl.DateTimeFormatOptions = {
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	month: "long",
	year: "numeric",
};

export function RecordInfoPanel({
	createdAt,
	lastUpdated,
}: {
	createdAt: Date;
	lastUpdated: Date;
}) {
	return (
		<div className="rounded-lg bg-card p-4">
			<div className="mb-3 font-bold text-sm">{t("Details")}</div>
			<dl className="flex flex-col gap-3 text-sm">
				<div className="flex items-center justify-between gap-4">
					<dt className="text-muted-foreground">{t("Created")}</dt>
					<Tooltip>
						<TooltipTrigger render={<dd />}>
							{formatRelativeTime(createdAt)}
						</TooltipTrigger>
						<TooltipContent>
							{createdAt.toLocaleString("de-DE", dateTimeFormat)}
						</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex items-center justify-between gap-4">
					<dt className="text-muted-foreground">{t("Last updated")}</dt>
					<Tooltip>
						<TooltipTrigger render={<dd />}>
							{formatRelativeTime(lastUpdated)}
						</TooltipTrigger>
						<TooltipContent>
							{lastUpdated.toLocaleString("de-DE", dateTimeFormat)}
						</TooltipContent>
					</Tooltip>
				</div>
			</dl>
		</div>
	);
}

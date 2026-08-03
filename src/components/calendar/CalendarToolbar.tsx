import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel } from "@/lib/calendarGrid";
import { t } from "@/lib/text";

type CalendarToolbarProps = {
	year: number;
	monthIndex: number;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
};

export const CalendarToolbar = ({
	year,
	monthIndex,
	onPrev,
	onNext,
	onToday,
}: CalendarToolbarProps) => {
	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("Previous month")}
					onClick={onPrev}
				>
					<ChevronLeftIcon />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("Next month")}
					onClick={onNext}
				>
					<ChevronRightIcon />
				</Button>
			</div>
			<h2 className="text-lg font-bold tabular-nums">
				{monthLabel(year, monthIndex)}
			</h2>
			<div className="flex-1" />
			<Button type="button" variant="outline" size="sm" onClick={onToday}>
				{t("Today")}
			</Button>
		</div>
	);
};

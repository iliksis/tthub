import { Link } from "@tanstack/react-router";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	buildMonthGrid,
	eventsOnDay,
	isSameDay,
	isSingleDayEvent,
	weekdayLabels,
} from "@/lib/calendarGrid";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
import { CalendarToolbar } from "./CalendarToolbar";
import { type CalendarAppointment, categoryStyle } from "./MonthCalendar";

type MobileCalendarProps = {
	appointments: CalendarAppointment[];
	year: number;
	monthIndex: number;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
};

const formatTime = (date: Date) =>
	date.toLocaleTimeString("de-DE", { timeStyle: "short" });

const formatShortDate = (date: Date) =>
	date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });

// Multi-day spans (holidays) read better as a date range than a time range
// — a holiday running midnight-to-midnight otherwise shows "00:00–00:00".
const formatEventTiming = (event: CalendarAppointment) =>
	isSingleDayEvent(event)
		? `${formatTime(event.start)}–${formatTime(event.end)}`
		: `${formatShortDate(event.start)} – ${formatShortDate(event.end)}`;

const dayHeaderLabel = (date: Date, today: Date) => {
	if (isSameDay(date, today)) return `${t("Today")} · ${formatShortDate(date)}`;
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);
	if (isSameDay(date, tomorrow))
		return `${t("Tomorrow")} · ${formatShortDate(date)}`;
	return date
		.toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "short",
			weekday: "long",
		})
		.replace(/^./, (c) => c.toUpperCase());
};

// A month grid is a real date picker on mobile: tapping any day moves the
// filled-circle selection there and the agenda below re-renders to that
// single day. `selected` tracks along whenever the URL-driven displayed
// month changes (prev/next/today), clamped into the new month, so the grid
// and agenda never point at different months.
export const MobileCalendar = ({
	appointments,
	year,
	monthIndex,
	onPrevMonth,
	onNextMonth,
	onToday,
}: MobileCalendarProps) => {
	const today = React.useMemo(() => new Date(), []);
	const [selected, setSelected] = React.useState(today);

	React.useEffect(() => {
		setSelected((prev) => {
			if (prev.getFullYear() === year && prev.getMonth() === monthIndex)
				return prev;
			const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
			return new Date(year, monthIndex, Math.min(prev.getDate(), daysInMonth));
		});
	}, [year, monthIndex]);

	const jumpToToday = () => {
		onToday();
		setSelected(today);
	};

	const weeks = buildMonthGrid(year, monthIndex, today);
	const selectedEvents = eventsOnDay(selected, appointments);

	return (
		<div className="overflow-hidden rounded-xl border border-border/40 bg-card text-card-foreground shadow-sm">
			<div className="px-4 pt-4 pb-3">
				<CalendarToolbar
					year={year}
					monthIndex={monthIndex}
					onPrev={onPrevMonth}
					onNext={onNextMonth}
					onToday={jumpToToday}
				/>
			</div>

			<div className="grid grid-cols-7 border-t border-border/40 bg-muted/30">
				{weekdayLabels.map((label) => (
					<div
						key={label}
						className="px-2 py-2.5 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
					>
						{label}
					</div>
				))}
			</div>

			<div className="px-2 pb-2">
				{weeks.map((week) => (
					<div
						key={week[0].fullDate.toISOString()}
						className="grid grid-cols-7"
					>
						{week.map((cell) => {
							const dots = eventsOnDay(cell.fullDate, appointments).slice(0, 2);
							const isSelected = isSameDay(cell.fullDate, selected);
							return (
								<button
									type="button"
									key={cell.fullDate.toISOString()}
									onClick={() => setSelected(cell.fullDate)}
									className="flex flex-col items-center gap-1 py-1.5"
								>
									<span
										className={cn(
											"flex size-7 items-center justify-center rounded-full text-sm transition-colors",
											isSelected
												? "bg-primary font-bold text-primary-foreground"
												: cell.isToday
													? "font-bold text-primary ring-1 ring-primary/50"
													: cell.inCurrentMonth
														? "text-foreground"
														: "text-muted-foreground/30",
										)}
									>
										{cell.date}
									</span>
									<div className="flex h-1.5 gap-1">
										{dots.map((event) => (
											<span
												key={event.id}
												className={cn(
													"size-1.5 rounded-full",
													categoryStyle[event.type].dot,
												)}
											/>
										))}
									</div>
								</button>
							);
						})}
					</div>
				))}
			</div>

			<div className="flex items-center justify-between border-border/40 border-t px-4 pt-3 pb-1">
				<div className="text-sm font-semibold">
					{dayHeaderLabel(selected, today)}
				</div>
				{!isSameDay(selected, today) && (
					<Button type="button" variant="ghost" size="sm" onClick={jumpToToday}>
						{t("Today")}
					</Button>
				)}
			</div>
			<div className="flex flex-col gap-2 px-4 pb-4">
				{selectedEvents.length === 0 ? (
					<div className="rounded-xl border border-border/60 border-dashed px-3 py-3 text-muted-foreground text-sm">
						{t("No appointment set")}
					</div>
				) : (
					selectedEvents.map((event) => (
						<Link
							key={event.id}
							to="/appts/$apptId"
							params={{ apptId: event.id }}
							className="flex items-stretch gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
						>
							<span
								className={cn(
									"w-1 shrink-0 rounded-full",
									categoryStyle[event.type].dot,
								)}
							/>
							<div className="min-w-0 flex-1">
								<div className="truncate font-semibold text-sm">
									{event.title}
								</div>
								<div className="text-muted-foreground text-xs">
									{formatEventTiming(event)}
								</div>
							</div>
						</Link>
					))
				)}
			</div>
		</div>
	);
};

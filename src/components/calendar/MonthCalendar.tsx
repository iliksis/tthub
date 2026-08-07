import { Link } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	assignWeekLanes,
	buildMonthGrid,
	eventsForWeek,
	isSingleDayEvent,
	type WeekBar,
	weekdayLabels,
} from "@/lib/calendarGrid";
import type { AppointmentType } from "@/lib/prisma/enums";
import { CalendarToolbar } from "./CalendarToolbar";

export type CalendarAppointment = {
	id: string;
	title: string;
	shortTitle: string;
	start: Date;
	end: Date;
	type: AppointmentType;
};

// Fixed height regardless of content: a day-number row plus a fixed number
// of lane rows — the last lane row is reserved exclusively for the overflow
// badge, never for a bar, so content can never grow the row.
const MAX_VISIBLE_LANES = 2;
const OVERFLOW_ROW_INDEX = MAX_VISIBLE_LANES + 2;
const NUMBER_ROW = "32px";
const LANE_ROW = "26px";
const ROW_GAP = "5px";
const ROW_TEMPLATE = [
	NUMBER_ROW,
	...Array(MAX_VISIBLE_LANES + 1).fill(LANE_ROW),
].join(" ");

export const categoryStyle: Record<
	AppointmentType,
	{ gradient: string; solidText: string; dot: string }
> = {
	HOLIDAY: {
		dot: "bg-primary",
		gradient: "bg-gradient-to-br from-primary to-primary/70",
		solidText: "text-primary-foreground",
	},
	TOURNAMENT: {
		dot: "bg-success",
		gradient: "bg-gradient-to-br from-success to-success/70",
		solidText: "text-success-foreground",
	},
	TOURNAMENT_DE: {
		dot: "bg-info",
		gradient: "bg-gradient-to-br from-info to-info/70",
		solidText: "text-info-foreground",
	},
};

const formatTime = (date: Date) =>
	date.toLocaleTimeString("de-DE", { timeStyle: "short" });

type MonthCalendarProps = {
	appointments: CalendarAppointment[];
	year: number;
	monthIndex: number;
	onPrevMonth: () => void;
	onNextMonth: () => void;
	onToday: () => void;
};

export const MonthCalendar = ({
	appointments,
	year,
	monthIndex,
	onPrevMonth,
	onNextMonth,
	onToday,
}: MonthCalendarProps) => {
	const today = new Date();
	const weeks = buildMonthGrid(year, monthIndex, today);

	return (
		<div className="overflow-hidden rounded-xl border border-border/40 bg-card text-card-foreground shadow-sm">
			<div className="px-5 pt-4 pb-3">
				<CalendarToolbar
					year={year}
					monthIndex={monthIndex}
					onPrev={onPrevMonth}
					onNext={onNextMonth}
					onToday={onToday}
				/>
			</div>

			<div className="grid grid-cols-7 border-t border-border/40 bg-muted/30">
				{weekdayLabels.map((label) => (
					<div
						key={label}
						className="px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
					>
						{label}
					</div>
				))}
			</div>

			{weeks.map((week, weekIndex) => {
				const weekEvents = eventsForWeek(week, appointments);
				const bars = assignWeekLanes(week, weekEvents, {
					includePaddingDays: true,
				});
				const visibleBars = bars.filter((b) => b.lane < MAX_VISIBLE_LANES);
				const hiddenByCol: WeekBar<CalendarAppointment>[][] = Array.from(
					{ length: 7 },
					() => [],
				);
				for (const bar of bars) {
					if (bar.lane < MAX_VISIBLE_LANES) continue;
					for (let col = bar.startCol; col <= bar.endCol; col++) {
						hiddenByCol[col].push(bar);
					}
				}

				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed weeks, position never reorders
						key={weekIndex}
						className="grid grid-cols-7"
						style={{ gridTemplateRows: ROW_TEMPLATE, rowGap: ROW_GAP }}
					>
						{week.map((_cell, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 columns
								key={`bg-${i}`}
								style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
								className="border-t border-l border-border/30 first:border-l-0"
							/>
						))}

						{week.map((cell, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 columns
								key={`num-${i}`}
								style={{ gridColumn: i + 1, gridRow: 1 }}
								className="flex justify-end px-2 pt-2 pr-1.5"
							>
								{cell.isToday ? (
									<span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
										{cell.date}
									</span>
								) : (
									<span
										className={
											cell.inCurrentMonth
												? "text-xs text-foreground"
												: "text-xs text-muted-foreground/40"
										}
									>
										{cell.date}
									</span>
								)}
							</div>
						))}

						{visibleBars.map((bar) => {
							const style = categoryStyle[bar.event.type];
							if (isSingleDayEvent(bar.event)) {
								return (
									<Link
										key={bar.event.id}
										to="/appts/$apptId"
										params={{ apptId: bar.event.id }}
										style={{
											gridColumn: bar.startCol + 1,
											gridRow: bar.lane + 2,
										}}
										className="mx-1 flex h-[26px] items-center gap-2 truncate rounded-lg px-2 text-[11px] font-medium text-foreground"
									>
										<span
											className={`size-2 shrink-0 rounded-full ${style.dot}`}
										/>
										<span className="truncate">{bar.event.shortTitle}</span>
									</Link>
								);
							}
							return (
								<Link
									key={bar.event.id}
									to="/appts/$apptId"
									params={{ apptId: bar.event.id }}
									title={bar.event.title}
									style={{
										gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
										gridRow: bar.lane + 2,
									}}
									className={`mx-1 flex h-[26px] items-center truncate rounded-lg px-2 text-[11px] font-semibold ${style.gradient} ${style.solidText} ${bar.isTrueStart ? "" : "rounded-l-none"} ${bar.isTrueEnd ? "" : "rounded-r-none"}`}
								>
									{bar.isTrueStart ? bar.event.shortTitle : ""}
								</Link>
							);
						})}

						{hiddenByCol.map((hidden, col) =>
							hidden.length > 0 && week[col].inCurrentMonth ? (
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 columns per fixed week
								<DropdownMenu key={`overflow-${weekIndex}-${col}`}>
									<DropdownMenuTrigger
										render={
											<button
												type="button"
												style={{
													gridColumn: col + 1,
													gridRow: OVERFLOW_ROW_INDEX,
												}}
												className="mx-1 h-[26px] rounded-lg px-2 text-left text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
											/>
										}
									>
										+{new Set(hidden.map((b) => b.event.id)).size}
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start" className="w-56 p-2">
										<div className="flex flex-col gap-1">
											{[
												...new Map(
													hidden.map((b) => [b.event.id, b.event]),
												).values(),
											].map((event) => (
												<DropdownMenuItem
													key={event.id}
													render={
														<Link
															to="/appts/$apptId"
															params={{ apptId: event.id }}
															className="flex items-center gap-2"
														/>
													}
												>
													<span
														className={`size-1.5 shrink-0 rounded-full ${categoryStyle[event.type].dot}`}
													/>
													<span className="truncate font-medium">
														{event.title}
													</span>
													<span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
														{formatTime(event.start)}
													</span>
												</DropdownMenuItem>
											))}
										</div>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null,
						)}
					</div>
				);
			})}
		</div>
	);
};

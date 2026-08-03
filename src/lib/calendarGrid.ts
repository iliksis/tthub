export type MonthCell = {
	date: number;
	inCurrentMonth: boolean;
	isToday: boolean;
	fullDate: Date;
};

export const weekdayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const buildMonthGrid = (
	year: number,
	monthIndex: number,
	today: Date,
): MonthCell[][] => {
	const firstOfMonth = new Date(year, monthIndex, 1);
	// getDay(): 0=Sun..6=Sat. Convert to a Monday-first offset (matches the
	// old FullCalendar firstDay=1, and de-DE convention).
	const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
	const gridStart = new Date(year, monthIndex, 1 - mondayOffset);

	const weeks: MonthCell[][] = [];
	const cursor = new Date(gridStart);
	for (let week = 0; week < 6; week++) {
		const days: MonthCell[] = [];
		for (let day = 0; day < 7; day++) {
			days.push({
				date: cursor.getDate(),
				fullDate: new Date(cursor),
				inCurrentMonth: cursor.getMonth() === monthIndex,
				isToday:
					cursor.getFullYear() === today.getFullYear() &&
					cursor.getMonth() === today.getMonth() &&
					cursor.getDate() === today.getDate(),
			});
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(days);
	}
	return weeks;
};

export const monthLabel = (year: number, monthIndex: number) =>
	new Date(year, monthIndex, 1)
		.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
		.replace(/^./, (c) => c.toUpperCase());

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate());

export type DayRangeEvent = { id: string; start: Date; end: Date };

const coversDay = (event: DayRangeEvent, day: Date) => {
	const d = startOfDay(day).getTime();
	return (
		d >= startOfDay(event.start).getTime() &&
		d <= startOfDay(event.end).getTime()
	);
};

// Returns every event that overlaps any day in `week` (day-level
// comparison), including events that only touch the week's leading/trailing
// padding days.
export const eventsForWeek = <T extends DayRangeEvent>(
	week: MonthCell[],
	events: T[],
): T[] => {
	const start = week[0].fullDate.getTime();
	const end = week[6].fullDate.getTime();
	return events.filter(
		(e) => e.start.getTime() <= end + 86400000 - 1 && e.end.getTime() >= start,
	);
};

export type WeekBar<T> = {
	event: T;
	startCol: number;
	endCol: number;
	lane: number;
	isTrueStart: boolean;
	isTrueEnd: boolean;
};

// Greedy interval-scheduling lane assignment: events are placed column-wise
// across a 7-day week, then packed into the fewest stacked lanes such that
// no two events sharing a lane overlap in columns. Longer spans are
// prioritized into lower lanes so they read as the "backbone" of the week.
export const assignWeekLanes = <T extends DayRangeEvent>(
	week: MonthCell[],
	events: T[],
	{ includePaddingDays = true }: { includePaddingDays?: boolean } = {},
): WeekBar<T>[] => {
	const bars: Omit<WeekBar<T>, "lane">[] = [];

	for (const event of events) {
		let startCol = -1;
		let endCol = -1;
		week.forEach((cell, i) => {
			if (!includePaddingDays && !cell.inCurrentMonth) return;
			if (coversDay(event, cell.fullDate)) {
				if (startCol === -1) startCol = i;
				endCol = i;
			}
		});
		if (startCol === -1) continue;
		bars.push({
			endCol,
			event,
			isTrueEnd:
				startOfDay(event.end).getTime() ===
				startOfDay(week[endCol].fullDate).getTime(),
			isTrueStart:
				startOfDay(event.start).getTime() ===
				startOfDay(week[startCol].fullDate).getTime(),
			startCol,
		});
	}

	bars.sort(
		(a, b) =>
			a.startCol - b.startCol ||
			b.endCol - b.startCol - (a.endCol - a.startCol),
	);

	const lanes: (typeof bars)[number][][] = [];
	const result: WeekBar<T>[] = [];
	for (const bar of bars) {
		let laneIndex = lanes.findIndex(
			(lane) =>
				!lane.some(
					(b) => !(bar.endCol < b.startCol || bar.startCol > b.endCol),
				),
		);
		if (laneIndex === -1) {
			lanes.push([]);
			laneIndex = lanes.length - 1;
		}
		lanes[laneIndex]?.push(bar);
		result.push({ ...bar, lane: laneIndex });
	}
	return result;
};

export const isSingleDayEvent = (event: DayRangeEvent) =>
	event.start.toDateString() === event.end.toDateString();

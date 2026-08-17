import { createHash } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type ClickTTStanding = {
	rank: number;
	team: string;
	wins: number;
	draws: number;
	undecided: number;
	losses: number;
	matchesWon: number;
	matchesLost: number;
	diff: number;
	pointsWon: number;
	pointsLost: number;
};

export type ClickTTMatch = {
	date: string;
	time: string;
	home: string;
	away: string;
};

export type ClickTTSchedule = {
	standings: ClickTTStanding[];
	matches: ClickTTMatch[];
};

type TextItem = { str: string; x: number; y: number; w: number };
type TextRow = { y: number; text: string };

// The standings table and match plan are printed side by side on the page;
// this is the x-coordinate that separates the two columns for the report
// layout ("... Tabelle und Spielplan") this parser targets.
const COLUMN_SPLIT_X = 380;

const STANDING_ROW_PATTERN =
	/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+)\s+(-?\d+)\s+(\d+):(\d+)$/;
const MATCH_ROW_WITH_DATE_PATTERN =
	/^([A-Za-zä.]+\.?\s*\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s*\(\d+\)\s+(.+)$/;
const MATCH_ROW_TIME_ONLY_PATTERN = /^(\d{2}:\d{2})\s*\(\d+\)\s+(.+)$/;

/**
 * Parses a "Tabelle und Spielplan" (standings + match plan) report PDF as exported by click-tt.
 */
export async function parseClickTTPdf(
	data: Uint8Array | ArrayBuffer,
): Promise<ClickTTSchedule> {
	// pdfjs rejects Node's `Buffer` (a Uint8Array subclass) outright, so this
	// always hands it a plain Uint8Array regardless of what was passed in.
	const bytes =
		data instanceof ArrayBuffer
			? new Uint8Array(data)
			: new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
	const doc = await pdfjsLib.getDocument({ data: bytes }).promise;

	const items: TextItem[] = [];
	for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
		const page = await doc.getPage(pageNum);
		const content = await page.getTextContent();
		for (const item of content.items) {
			if (!("str" in item) || item.str.trim() === "") continue;
			const [, , , , x, y] = item.transform;
			items.push({ str: item.str, w: item.width, x, y: Math.round(y) });
		}
	}

	const { leftRows, rightRows } = splitColumns(items);
	const standings = parseStandings(leftRows);
	const teamNames = standings.map((s) => s.team);
	return {
		matches: parseMatches(rightRows, teamNames),
		standings,
	};
}

/**
 * Narrows a parsed schedule down to standings/matches involving one club.
 * Team names carry a per-team Roman numeral suffix (e.g. "SB Versbach II"),
 * so this matches by prefix rather than exact equality.
 */
export function filterClickTTScheduleByClub(
	schedule: ClickTTSchedule,
	clubName: string,
): ClickTTSchedule {
	const isClubTeam = (team: string) =>
		team === clubName || team.startsWith(`${clubName} `);
	return {
		matches: schedule.matches.filter(
			(m) => isClubTeam(m.home) || isClubTeam(m.away),
		),
		standings: schedule.standings.filter((s) => isClubTeam(s.team)),
	};
}

/**
 * Deterministic Appointment id for a team match, derived from the team's
 * click-TT group (so re-imports update the same row instead of creating a
 * duplicate when only the match date changes) and the two team names.
 */
export function createTeamMatchAppointmentId(
	clickTTGroupId: string,
	home: string,
	away: string,
): string {
	return createHash("sha1")
		.update(`${clickTTGroupId}:${home}:${away}`)
		.digest("base64url")
		.slice(0, 12);
}

/** Combines a match's "dd.mm.yyyy" date and "hh:mm" time into a Date. */
export function parseClickTTMatchDate(match: ClickTTMatch): Date {
	const dateMatch = match.date.match(/(\d{2})\.(\d{2})\.(\d{4})/);
	if (!dateMatch) {
		throw new Error(`Unrecognized match date: "${match.date}"`);
	}
	const [, day, month, year] = dateMatch;
	const [hour, minute] = match.time.split(":");
	return new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
	);
}

function splitColumns(items: TextItem[]): {
	leftRows: TextRow[];
	rightRows: TextRow[];
} {
	const rowsByY = new Map<number, TextItem[]>();
	for (const item of items) {
		const row = rowsByY.get(item.y);
		if (row) row.push(item);
		else rowsByY.set(item.y, [item]);
	}

	// Merge visual rows whose y-coordinates are within a small tolerance
	// (sub-pixel jitter between glyphs placed on the same printed line).
	const sortedY = [...rowsByY.keys()].sort((a, b) => b - a);
	const merged: { y: number; items: TextItem[] }[] = [];
	for (const y of sortedY) {
		const last = merged[merged.length - 1];
		const rowItems = rowsByY.get(y) ?? [];
		if (last && Math.abs(last.y - y) <= 2) last.items.push(...rowItems);
		else merged.push({ items: [...rowItems], y });
	}
	for (const row of merged) row.items.sort((a, b) => a.x - b.x);

	const leftRows: TextRow[] = [];
	const rightRows: TextRow[] = [];
	for (const row of merged) {
		const left = row.items.filter((i) => i.x < COLUMN_SPLIT_X);
		const right = row.items.filter((i) => i.x >= COLUMN_SPLIT_X);
		if (left.length) leftRows.push({ text: rowText(left), y: row.y });
		if (right.length) rightRows.push({ text: rowText(right), y: row.y });
	}

	return { leftRows, rightRows };
}

function rowText(rowItems: TextItem[]): string {
	let text = "";
	let prevX: number | null = null;
	let prevW = 0;
	for (const item of rowItems) {
		if (prevX !== null && item.x - (prevX + prevW) > 2) text += " ";
		text += item.str;
		prevX = item.x;
		prevW = item.w;
	}
	return text.trim();
}

function parseStandings(rows: TextRow[]): ClickTTStanding[] {
	const standings: ClickTTStanding[] = [];
	for (const row of rows) {
		const m = row.text.match(STANDING_ROW_PATTERN);
		if (!m) continue;
		standings.push({
			diff: Number(m[9]),
			draws: Number(m[4]),
			losses: Number(m[6]),
			matchesLost: Number(m[8]),
			matchesWon: Number(m[7]),
			pointsLost: Number(m[11]),
			pointsWon: Number(m[10]),
			rank: Number(m[1]),
			team: m[2],
			undecided: Number(m[5]),
			wins: Number(m[3]),
		});
	}
	return standings;
}

function parseMatches(rows: TextRow[], teamNames: string[]): ClickTTMatch[] {
	// A date/time cell can hold multiple matches stacked on top of each other;
	// only the first printed row carries the date, so later rows in the same
	// block inherit it.
	const pending: { date: string; time: string; rest: string }[] = [];
	let currentDate: string | null = null;
	for (const row of rows) {
		const withDate = row.text.match(MATCH_ROW_WITH_DATE_PATTERN);
		const timeOnly = row.text.match(MATCH_ROW_TIME_ONLY_PATTERN);
		if (withDate) {
			currentDate = withDate[1];
			pending.push({ date: currentDate, rest: withDate[3], time: withDate[2] });
		} else if (timeOnly && currentDate) {
			pending.push({ date: currentDate, rest: timeOnly[2], time: timeOnly[1] });
		}
	}

	// The "Heimmannschaft Gastmannschaft" cell is glued into one string by
	// column extraction; split it using the standings table's team names
	// (longest first, so e.g. "TSV Bad Musterstadt II" isn't shadowed by a
	// shorter, unrelated prefix match).
	const namesByLength = [...teamNames].sort((a, b) => b.length - a.length);
	const matches: ClickTTMatch[] = [];
	for (const { date, time, rest } of pending) {
		const home = namesByLength.find((name) => rest.startsWith(name));
		if (!home) continue;
		const away = rest.slice(home.length).trim();
		matches.push({ away, date, home, time });
	}
	return matches;
}

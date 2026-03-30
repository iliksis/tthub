import type { AppointmentType } from "@/lib/prisma/enums";
import { t } from "./text";

export const AGE_GROUP_KEYS = ["u11", "u13", "u15", "u19", "adult"] as const;
export type AgeGroupKey = (typeof AGE_GROUP_KEYS)[number];

export const PLACEMENT_BUCKET_KEYS = [
	"first",
	"second",
	"third",
	"top8",
	"other",
	"unplaced",
] as const;
export type PlacementBucketKey = (typeof PLACEMENT_BUCKET_KEYS)[number];

type StatisticsPlayer = {
	id: string;
	name: string;
	year: number;
};

type StatisticsPlacement = {
	appointmentId: string;
	category: string;
	placement: string | null;
	playerId: string;
	player: StatisticsPlayer;
};

export type StatisticsAppointment = {
	id: string;
	nextAppointmentId: string | null;
	shortTitle: string;
	startDate: Date;
	title: string;
	type: AppointmentType;
	placements: StatisticsPlacement[];
};

export type SeasonWithAgeGroupCounts = {
	id: string;
	title: string;
	startDate: Date;
	endDate: Date;
	ageGroupCounts: Array<{
		ageGroup: string;
		playerCount: number;
	}>;
};

type SeasonStatistics = {
	ageGroupCounts: Record<AgeGroupKey, number>;
	participationCount: number;
	placementBuckets: Record<PlacementBucketKey, number>;
	playerCount: number;
	tournamentCount: number;
	tournamentParticipants: number;
	typeCounts: Record<AppointmentType, number>;
};

type LinkedTournamentPoint = {
	date: string;
	label: string;
	participations: number;
	participants: number;
	title: string;
};

export type StatisticsData = {
	ageGroupCountsBySeason: Array<
		Record<AgeGroupKey | "season", number | string>
	>;
	currentSeason: string;
	linkedTournamentSeries: Array<{
		id: string;
		name: string;
		points: LinkedTournamentPoint[];
	}>;
	playerCountsBySeason: Array<{
		players: number;
		season: string;
	}>;
	summary: {
		playerDelta: number;
		players: number;
		previousSeason: string | null;
		tournamentDelta: number;
		tournaments: number;
	};
	visibleSeasons: string[];
};

export const createEmptyAgeGroupCounts = (): Record<AgeGroupKey, number> => ({
	adult: 0,
	u11: 0,
	u13: 0,
	u15: 0,
	u19: 0,
});

const createSeasonStatistics = (
	ageGroupCounts: Record<AgeGroupKey, number>,
): SeasonStatistics => ({
	ageGroupCounts,
	participationCount: 0,
	placementBuckets: {
		first: 0,
		other: 0,
		second: 0,
		third: 0,
		top8: 0,
		unplaced: 0,
	},
	playerCount: Object.values(ageGroupCounts).reduce(
		(total, count) => total + count,
		0,
	),
	tournamentCount: 0,
	tournamentParticipants: 0,
	typeCounts: {
		HOLIDAY: 0,
		TOURNAMENT: 0,
		TOURNAMENT_DE: 0,
	},
});

export const createSeasonTitle = (startDate: Date, endDate: Date) => {
	const startYear = startDate.getFullYear();
	const endYear = endDate.getFullYear();
	if (startYear === endYear) return String(startYear);
	return `${startYear}/${String(endYear).slice(-2)}`;
};

export const calculateAgeGroupForSeason = (
	birthYear: number,
	seasonStartYear: number,
): AgeGroupKey => {
	const ageAtSeasonEnd = seasonStartYear + 1 - birthYear;

	if (ageAtSeasonEnd < 11) return "u11";
	if (ageAtSeasonEnd < 13) return "u13";
	if (ageAtSeasonEnd < 15) return "u15";
	if (ageAtSeasonEnd < 19) return "u19";
	return "adult";
};

export const calculateAgeGroupForSeasonEndYear = (
	birthYear: number,
	seasonEndYear: number,
): AgeGroupKey => {
	const ageAtSeasonEnd = seasonEndYear - birthYear;

	if (ageAtSeasonEnd < 11) return "u11";
	if (ageAtSeasonEnd < 13) return "u13";
	if (ageAtSeasonEnd < 15) return "u15";
	if (ageAtSeasonEnd < 19) return "u19";
	return "adult";
};

export const createSeasonAgeGroupCounts = (
	players: Array<{ year: number }>,
	seasonEndDate: Date,
) => {
	const counts = createEmptyAgeGroupCounts();
	const seasonEndYear = seasonEndDate.getFullYear();

	for (const player of players) {
		const ageGroup = calculateAgeGroupForSeasonEndYear(
			player.year,
			seasonEndYear,
		);
		counts[ageGroup] += 1;
	}

	return AGE_GROUP_KEYS.map((ageGroup) => ({
		ageGroup,
		playerCount: counts[ageGroup],
	}));
};

export const hasSeasonOverlap = (
	seasons: Array<{ endDate: Date; id?: string; startDate: Date }>,
	startDate: Date,
	endDate: Date,
	excludeId?: string,
) => {
	return seasons.some((season) => {
		if (excludeId && season.id === excludeId) return false;
		return startDate <= season.endDate && endDate >= season.startDate;
	});
};

export const getAgeGroupLabel = (ageGroup: AgeGroupKey) => {
	const labels: Record<AgeGroupKey, string> = {
		adult: t("Adult"),
		u11: "U11",
		u13: "U13",
		u15: "U15",
		u19: "U19",
	};

	return labels[ageGroup];
};

export const bucketPlacement = (
	placement: string | null | undefined,
): PlacementBucketKey => {
	const normalized = placement?.trim().toLowerCase();
	if (!normalized) return "unplaced";

	const position = normalized.match(/^(\d+)/)?.[1];
	if (position) {
		const rank = Number(position);
		if (rank === 1) return "first";
		if (rank === 2) return "second";
		if (rank === 3) return "third";
		if (rank <= 8) return "top8";
		return "other";
	}

	if (/sieger|winner/.test(normalized)) return "first";
	if (/semi|halbfinal/.test(normalized)) return "top8";
	if (/quarter|viertelfinal/.test(normalized)) return "top8";
	if (/runner|vice|2\. platz/.test(normalized)) return "second";
	if (/^finale?$/.test(normalized)) return "second";

	return "other";
};

const normalizeAgeGroupCounts = (
	ageGroupCounts: SeasonWithAgeGroupCounts["ageGroupCounts"],
) => {
	const counts = createEmptyAgeGroupCounts();

	for (const count of ageGroupCounts) {
		if (!AGE_GROUP_KEYS.includes(count.ageGroup as AgeGroupKey)) continue;
		counts[count.ageGroup as AgeGroupKey] = count.playerCount;
	}

	return counts;
};

const createLinkedTournamentSeries = (
	appointments: StatisticsAppointment[],
) => {
	const appointmentsById = new Map(
		appointments
			.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
			.map((appointment) => [appointment.id, appointment]),
	);
	const incomingEdges = new Map<string, number>();

	for (const appointment of appointments) {
		if (!appointment.nextAppointmentId) continue;
		incomingEdges.set(
			appointment.nextAppointmentId,
			(incomingEdges.get(appointment.nextAppointmentId) ?? 0) + 1,
		);
	}

	const linkedAppointments = appointments.filter(
		(appointment) =>
			appointment.nextAppointmentId !== null ||
			incomingEdges.has(appointment.id),
	);
	const visited = new Set<string>();
	const sequences: StatisticsAppointment[][] = [];

	const followSequence = (start: StatisticsAppointment) => {
		const sequence: StatisticsAppointment[] = [];
		const seenInSequence = new Set<string>();
		let current: StatisticsAppointment | undefined = start;

		while (current && !seenInSequence.has(current.id)) {
			sequence.push(current);
			seenInSequence.add(current.id);
			visited.add(current.id);
			current = current.nextAppointmentId
				? appointmentsById.get(current.nextAppointmentId)
				: undefined;
		}

		return sequence;
	};

	const roots = linkedAppointments
		.filter((appointment) => !incomingEdges.has(appointment.id))
		.sort(
			(left, right) => left.startDate.getTime() - right.startDate.getTime(),
		);

	for (const root of roots) {
		const sequence = followSequence(root);
		if (sequence.length > 1) sequences.push(sequence);
	}

	for (const appointment of linkedAppointments) {
		if (visited.has(appointment.id)) continue;
		const sequence = followSequence(appointment);
		if (sequence.length > 1) sequences.push(sequence);
	}

	return sequences.map((sequence) => ({
		id: sequence[0].id,
		name: sequence[0].title,
		points: sequence.map((appointment) => ({
			date: appointment.startDate.toISOString(),
			label: appointment.shortTitle || appointment.title,
			participants: new Set(
				appointment.placements.map((placement) => placement.playerId),
			).size,
			participations: appointment.placements.length,
			title: appointment.shortTitle || appointment.title,
		})),
	}));
};

const findSeasonIndex = (seasons: SeasonWithAgeGroupCounts[], date: Date) => {
	return seasons.findIndex(
		(season) => date >= season.startDate && date <= season.endDate,
	);
};

const getCurrentSeason = (seasons: SeasonWithAgeGroupCounts[], date: Date) => {
	return (
		seasons.find(
			(season) => date >= season.startDate && date <= season.endDate,
		) ?? null
	);
};

export const buildStatistics = (
	inputSeasons: SeasonWithAgeGroupCounts[],
	appointments: StatisticsAppointment[],
): StatisticsData => {
	const seasons = [...inputSeasons].sort(
		(left, right) => left.startDate.getTime() - right.startDate.getTime(),
	);
	const visibleSeasons = seasons.map((season) => season.title);
	const seasonStatistics = new Map(
		seasons.map((season) => {
			const ageGroupCounts = normalizeAgeGroupCounts(season.ageGroupCounts);
			return [season.id, createSeasonStatistics(ageGroupCounts)] as const;
		}),
	);
	const currentSeason = getCurrentSeason(seasons, new Date());
	const appointmentsInCurrentSeason: StatisticsAppointment[] = [];

	for (const appointment of appointments) {
		const seasonIndex = findSeasonIndex(seasons, appointment.startDate);
		if (seasonIndex === -1) continue;

		const season = seasons[seasonIndex];
		const thisSeason = seasonStatistics.get(season.id);
		if (!thisSeason) continue;

		if (season.id === currentSeason?.id) {
			appointmentsInCurrentSeason.push(appointment);
		}

		thisSeason.tournamentCount += 1;
		thisSeason.tournamentParticipants += new Set(
			appointment.placements.map((placement) => placement.playerId),
		).size;
		thisSeason.typeCounts[appointment.type] += 1;

		for (const placement of appointment.placements) {
			thisSeason.participationCount += 1;
			thisSeason.placementBuckets[bucketPlacement(placement.placement)] += 1;
		}
	}

	const playerCountsBySeason = seasons.map((season) => ({
		players: seasonStatistics.get(season.id)?.playerCount ?? 0,
		season: season.title,
	}));

	const ageGroupCountsBySeason = seasons.map((season) => {
		const counts =
			seasonStatistics.get(season.id)?.ageGroupCounts ??
			createEmptyAgeGroupCounts();
		return {
			adult: counts.adult,
			season: season.title,
			u11: counts.u11,
			u13: counts.u13,
			u15: counts.u15,
			u19: counts.u19,
		};
	});

	const previousSeason = getCurrentSeason(
		seasons,
		new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
	);
	const currentStatistics = currentSeason
		? (seasonStatistics.get(currentSeason.id) ??
			createSeasonStatistics(createEmptyAgeGroupCounts()))
		: createSeasonStatistics(createEmptyAgeGroupCounts());
	const previousStatistics = previousSeason
		? (seasonStatistics.get(previousSeason.id) ??
			createSeasonStatistics(createEmptyAgeGroupCounts()))
		: createSeasonStatistics(createEmptyAgeGroupCounts());

	return {
		ageGroupCountsBySeason,
		currentSeason: currentSeason?.title ?? "",
		linkedTournamentSeries: createLinkedTournamentSeries(
			appointmentsInCurrentSeason,
		),
		playerCountsBySeason,
		summary: {
			playerDelta:
				currentStatistics.playerCount - previousStatistics.playerCount,
			players: currentStatistics.playerCount,
			previousSeason: previousSeason?.title ?? null,
			tournamentDelta:
				currentStatistics.tournamentCount - previousStatistics.tournamentCount,
			tournaments: currentStatistics.tournamentCount,
		},
		visibleSeasons,
	};
};

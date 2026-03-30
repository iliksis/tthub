import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentType } from "@/lib/prisma/enums";
import {
	bucketPlacement,
	buildStatistics,
	calculateAgeGroupForSeason,
	calculateAgeGroupForSeasonEndYear,
	createSeasonAgeGroupCounts,
	createSeasonTitle,
	hasSeasonOverlap,
	type SeasonWithAgeGroupCounts,
	type StatisticsAppointment,
} from "./statistics";

const createAppointment = (
	overrides: Partial<StatisticsAppointment>,
): StatisticsAppointment => ({
	id: overrides.id ?? "appt-1",
	nextAppointmentId: overrides.nextAppointmentId ?? null,
	placements: overrides.placements ?? [],
	shortTitle: overrides.shortTitle ?? "Series 1",
	startDate: overrides.startDate ?? new Date("2025-10-10T10:00:00Z"),
	title: overrides.title ?? "Series 1",
	type: overrides.type ?? AppointmentType.TOURNAMENT,
});

const createSeason = (
	overrides: Partial<SeasonWithAgeGroupCounts>,
): SeasonWithAgeGroupCounts => ({
	ageGroupCounts: overrides.ageGroupCounts ?? [],
	endDate: overrides.endDate ?? new Date("2026-08-31T23:59:59Z"),
	id: overrides.id ?? "season-1",
	startDate: overrides.startDate ?? new Date("2025-09-01T00:00:00Z"),
	title: overrides.title ?? "2025/26",
});

describe("statistics helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-30T10:00:00Z"));
	});

	it("creates the expected season title from dates", () => {
		expect(
			createSeasonTitle(
				new Date("2025-09-01T00:00:00Z"),
				new Date("2026-08-31T23:59:59Z"),
			),
		).toBe("2025/26");
	});

	it("calculates age groups relative to the derived season year", () => {
		expect(calculateAgeGroupForSeason(2017, 2025)).toBe("u11");
		expect(calculateAgeGroupForSeason(2014, 2025)).toBe("u13");
		expect(calculateAgeGroupForSeason(2012, 2025)).toBe("u15");
		expect(calculateAgeGroupForSeason(2008, 2025)).toBe("u19");
		expect(calculateAgeGroupForSeason(2000, 2025)).toBe("adult");
	});

	it("generates stored season age-group counts from players", () => {
		expect(
			createSeasonAgeGroupCounts(
				[{ year: 2010 }, { year: 2011 }, { year: 2000 }],
				new Date("2026-08-31T23:59:59Z"),
			),
		).toEqual([
			{ ageGroup: "u11", playerCount: 0 },
			{ ageGroup: "u13", playerCount: 0 },
			{ ageGroup: "u15", playerCount: 0 },
			{ ageGroup: "u19", playerCount: 2 },
			{ ageGroup: "adult", playerCount: 1 },
		]);
		expect(calculateAgeGroupForSeasonEndYear(2010, 2026)).toBe("u19");
	});

	it("detects overlapping seasons", () => {
		expect(
			hasSeasonOverlap(
				[
					{
						endDate: new Date("2026-08-31T23:59:59Z"),
						id: "season-1",
						startDate: new Date("2025-09-01T00:00:00Z"),
					},
				],
				new Date("2026-01-01T00:00:00Z"),
				new Date("2026-12-31T00:00:00Z"),
			),
		).toBe(true);
		expect(
			hasSeasonOverlap(
				[
					{
						endDate: new Date("2026-08-31T23:59:59Z"),
						id: "season-1",
						startDate: new Date("2025-09-01T00:00:00Z"),
					},
				],
				new Date("2026-09-01T00:00:00Z"),
				new Date("2027-08-31T00:00:00Z"),
			),
		).toBe(false);
	});

	it("groups placement text into summary buckets", () => {
		expect(bucketPlacement("1")).toBe("first");
		expect(bucketPlacement("2. Platz")).toBe("second");
		expect(bucketPlacement("3rd")).toBe("third");
		expect(bucketPlacement("7")).toBe("top8");
		expect(bucketPlacement("Quarterfinal")).toBe("top8");
		expect(bucketPlacement("Participation")).toBe("other");
		expect(bucketPlacement(null)).toBe("unplaced");
	});

	it("builds season summaries and linked tournament trends", () => {
		const data = buildStatistics(
			[
				createSeason({
					ageGroupCounts: [
						{ ageGroup: "u11", playerCount: 0 },
						{ ageGroup: "u13", playerCount: 0 },
						{ ageGroup: "u15", playerCount: 0 },
						{ ageGroup: "u19", playerCount: 4 },
						{ ageGroup: "adult", playerCount: 1 },
					],
					id: "season-2",
					title: "2025/26",
				}),
				createSeason({
					ageGroupCounts: [
						{ ageGroup: "u11", playerCount: 0 },
						{ ageGroup: "u13", playerCount: 0 },
						{ ageGroup: "u15", playerCount: 0 },
						{ ageGroup: "u19", playerCount: 1 },
						{ ageGroup: "adult", playerCount: 2 },
					],
					endDate: new Date("2025-08-31T23:59:59Z"),
					id: "season-1",
					startDate: new Date("2024-09-01T00:00:00Z"),
					title: "2024/25",
				}),
			],
			[
				createAppointment({
					id: "a1",
					nextAppointmentId: "a2",
					placements: [
						{
							appointmentId: "a1",
							category: "U15",
							placement: "1",
							player: { id: "p1", name: "Alice", year: 2012 },
							playerId: "p1",
						},
						{
							appointmentId: "a1",
							category: "U15",
							placement: "4",
							player: { id: "p2", name: "Bob", year: 2011 },
							playerId: "p2",
						},
					],
					startDate: new Date("2025-10-10T10:00:00Z"),
					title: "Autumn Open",
				}),
				createAppointment({
					id: "a2",
					placements: [
						{
							appointmentId: "a2",
							category: "U15",
							placement: "2",
							player: { id: "p1", name: "Alice", year: 2012 },
							playerId: "p1",
						},
					],
					shortTitle: "Autumn Open 2",
					startDate: new Date("2026-01-10T10:00:00Z"),
					title: "Autumn Open",
				}),
				createAppointment({
					id: "a3",
					placements: [
						{
							appointmentId: "a3",
							category: "Adults",
							placement: null,
							player: { id: "p3", name: "Chris", year: 1998 },
							playerId: "p3",
						},
					],
					startDate: new Date("2024-10-10T10:00:00Z"),
					type: AppointmentType.TOURNAMENT_DE,
				}),
			],
		);

		expect(data.currentSeason).toBe("2025/26");
		expect(data.playerCountsBySeason.at(-1)).toEqual({
			players: 5,
			season: "2025/26",
		});
		expect(data.ageGroupCountsBySeason.at(-1)?.u19).toBe(4);
		expect(data.summary.players).toBe(5);
		expect(data.linkedTournamentSeries).toHaveLength(1);
		expect(data.linkedTournamentSeries[0].points).toHaveLength(2);
		expect(data.linkedTournamentSeries[0].points[0].participants).toBe(2);
	});
});

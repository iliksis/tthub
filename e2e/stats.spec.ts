import { expect, test } from "@playwright/test";
import { calculateAgeGroup } from "../src/lib/ageGroup";
import { prismaClient } from "../src/lib/db";
import { buildAgeGroupBreakdown } from "../src/lib/seasonStatistics";
import { loginAs } from "./helpers";

// Fixture seasons/teams/labels/players/appointments created by this spec are
// named with this prefix so tests can find their own rows regardless of
// leftover state from other runs, and so cleanup only ever removes what this
// spec created.
const PREFIX = "E2ESTATS-";

// Placement rows have no cascade delete on their Player/Appointment FKs (see
// e2e/helpers.ts's cleanupByTitlePrefix), so they must be deleted before the
// Appointments/Players they reference.
async function cleanupFixtures() {
	const staleAppointments = await prismaClient.appointment.findMany({
		select: { id: true },
		where: { title: { startsWith: PREFIX } },
	});
	await prismaClient.placement.deleteMany({
		where: { appointmentId: { in: staleAppointments.map((a) => a.id) } },
	});
	await prismaClient.appointment.deleteMany({
		where: { title: { startsWith: PREFIX } },
	});
	await prismaClient.player.deleteMany({
		where: { name: { startsWith: PREFIX } },
	});
	await prismaClient.label.deleteMany({
		where: { name: { startsWith: PREFIX } },
	});
	await prismaClient.team.deleteMany({
		where: { title: { startsWith: PREFIX } },
	});
	await prismaClient.season.deleteMany({
		where: { name: { startsWith: PREFIX } },
	});
}

test.beforeAll(cleanupFixtures);

test.afterAll(async () => {
	await cleanupFixtures();
	await prismaClient.$disconnect();
});

test.describe("Stats Route - Access Control", () => {
	test("ADMIN can access the stats page", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/stats");
		await expect(page).toHaveURL("/stats");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access the stats page", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/stats");
		await expect(page).toHaveURL("/stats");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access the stats page", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/stats");
		await expect(page).toHaveURL("/stats");
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users are redirected", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

// The page renders parallel mobile (`lg:hidden`) and desktop (`hidden
// lg:block`) trees — both stay in the DOM regardless of viewport, only CSS
// hides one of them. Every locator below is scoped with `:visible` (matching
// the convention in appointments-bulk.spec.ts / appointments.spec.ts) so it
// resolves to exactly one element instead of tripping Playwright's strict
// mode with 2 matches.
test.describe("Stats Route - Team League/Placement Table", () => {
	test("shows the active season's teams with league and table placement by default", async ({
		page,
	}) => {
		const activeSeason = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const teams = await prismaClient.team.findMany({
			where: { seasonId: activeSeason.id },
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		for (const team of teams) {
			await expect(
				page.locator(":visible", { hasText: team.title }).first(),
			).toBeVisible();
			if (team.league) {
				await expect(
					page.locator(":visible", { hasText: team.league }).first(),
				).toBeVisible();
			}
			if (team.placement) {
				await expect(
					page.locator(":visible", { hasText: team.placement }).first(),
				).toBeVisible();
			}
		}
	});

	test("shows a split team as two labelled rows and a non-split team as one", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Split` },
		});
		const splitTitle = `${PREFIX}SplitTeam`;
		const soloTitle = `${PREFIX}SoloTeam`;
		const hinrunde = await prismaClient.team.create({
			data: {
				half: "HINRUNDE",
				league: `${PREFIX}HinLiga`,
				placement: "3",
				seasonId: season.id,
				title: splitTitle,
			},
		});
		await prismaClient.team.create({
			data: {
				half: "RUECKRUNDE",
				hinrundeTeamId: hinrunde.id,
				league: `${PREFIX}RueckLiga`,
				placement: "1",
				seasonId: season.id,
				title: splitTitle,
			},
		});
		await prismaClient.team.create({
			data: {
				league: `${PREFIX}SoloLiga`,
				seasonId: season.id,
				title: soloTitle,
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		// Scoped to visible `<tr>`s: an ancestor such as `body` also matches
		// `:visible`, and its first "Hinrunde" would be in the hidden mobile tree.
		await expect(
			page.locator("tr:visible", { hasText: splitTitle }),
		).toHaveCount(2);
		const hinRow = page.locator("tr:visible", { hasText: `${PREFIX}HinLiga` });
		await expect(hinRow.getByText("Hinrunde")).toBeVisible();
		await expect(hinRow.getByText("3", { exact: true })).toBeVisible();
		const rueckRow = page.locator("tr:visible", {
			hasText: `${PREFIX}RueckLiga`,
		});
		await expect(rueckRow.getByText("Rückrunde")).toBeVisible();
		await expect(rueckRow.getByText("1", { exact: true })).toBeVisible();

		const soloRow = page.locator("tr:visible", { hasText: soloTitle });
		await expect(soloRow).toHaveCount(1);
		await expect(soloRow.getByText(/Hinrunde|Rückrunde/)).toHaveCount(0);
	});

	test("switching the season updates the displayed teams", async ({ page }) => {
		const otherSeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Other` },
		});
		const fixtureTeam = await prismaClient.team.create({
			data: {
				league: `${PREFIX}League`,
				seasonId: otherSeason.id,
				title: `${PREFIX}Team`,
			},
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");
		await expect(page.locator(`text=${fixtureTeam.title}`)).toHaveCount(0);

		await page.locator('[data-slot="select-trigger"]:visible').click();
		await page.getByRole("option", { name: otherSeason.name }).click();
		await page.waitForLoadState("networkidle");

		await expect(
			page.locator(":visible", { hasText: fixtureTeam.title }).first(),
		).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: `${PREFIX}League` }).first(),
		).toBeVisible();
	});

	test("a season with no teams shows an empty state instead of an error", async ({
		page,
	}) => {
		const emptySeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Empty` },
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		await page.locator('[data-slot="select-trigger"]:visible').click();
		await page.getByRole("option", { name: emptySeason.name }).click();
		await page.waitForLoadState("networkidle");

		await expect(
			page
				.locator(":visible", { hasText: "Keine Teams in dieser Saison" })
				.first(),
		).toBeVisible();
	});
});

test.describe("Stats Route - Player Count Over Seasons", () => {
	const CHART_NAME = "Spielerzahl im Saisonvergleich";

	// Hovers above a season's x-axis label to open that season's tooltip.
	async function hoverSeason(
		page: import("@playwright/test").Page,
		seasonName: string,
	) {
		const chart = page.getByRole("img", { name: CHART_NAME });
		const label = await chart
			.getByText(seasonName, { exact: true })
			.boundingBox();
		const plot = await chart.boundingBox();
		if (!label || !plot) throw new Error("chart not laid out");
		await page.mouse.move(label.x + label.width / 2, plot.y + plot.height / 2);
		return page.getByRole("status").filter({ hasText: seasonName });
	}

	// Seeds one Season with a stored Season Statistics record: 3 Eligible
	// Players (1 male, 1 female, 1 without a gender) out of 4 Players overall.
	async function seedCountFixture(suffix: string) {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}${suffix}` },
		});
		await prismaClient.seasonStatistics.create({
			data: {
				eligibleCount: 3,
				eligibleFemaleCount: 1,
				eligibleMaleCount: 1,
				playerCount: 4,
				seasonId: season.id,
			},
		});
		return season;
	}

	test("lists every season in chronological order", async ({ page }) => {
		const older = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}CountOlder` },
		});
		const newer = await prismaClient.season.create({
			data: {
				createdAt: new Date(Date.now() + 1000),
				isActive: false,
				name: `${PREFIX}CountNewer`,
			},
		});

		for (const season of [older, newer]) {
			await prismaClient.seasonStatistics.create({
				data: {
					eligibleCount: 1,
					eligibleFemaleCount: 0,
					eligibleMaleCount: 1,
					playerCount: 1,
					seasonId: season.id,
				},
			});
		}

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const chart = page.getByRole("img", { name: CHART_NAME });
		const olderBox = await chart
			.getByText(older.name, { exact: true })
			.boundingBox();
		const newerBox = await chart
			.getByText(newer.name, { exact: true })
			.boundingBox();
		if (!olderBox || !newerBox) throw new Error("chart not laid out");
		expect(newerBox.x).toBeGreaterThan(olderBox.x);
	});

	test("switching the season selector does not change the counts", async ({
		page,
	}) => {
		const season = await seedCountFixture("Sel");
		const other = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}SelB` },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		const tooltipRows = async () =>
			(await hoverSeason(page, season.name))
				.locator(".ts-chart-tooltip__row")
				.allInnerTexts();
		const before = await tooltipRows();
		expect(before).toHaveLength(4);

		await page.locator('[data-slot="select-trigger"]:visible').click();
		await page.getByRole("option", { name: other.name }).click();
		await page.waitForURL(new RegExp(`seasonId=${other.id}`));
		await page.waitForLoadState("networkidle");

		expect(await tooltipRows()).toEqual(before);
	});

	test("the chart plots every season on the x axis with a legend for the four series", async ({
		page,
	}) => {
		const season = await seedCountFixture("ChartLegend");

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const chart = page.getByRole("img", { name: CHART_NAME });
		await expect(chart).toBeVisible();
		await expect(chart.getByText(season.name, { exact: true })).toBeVisible();
		for (const label of [
			"Spielberechtigt gesamt",
			"Männlich",
			"Weiblich",
			"Alle Spieler",
		]) {
			await expect(chart.getByText(label, { exact: true })).toBeVisible();
		}
	});

	test("hovering a season shows a tooltip with all four counts", async ({
		page,
	}) => {
		const season = await seedCountFixture("ChartTooltip");

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const chart = page.getByRole("img", { name: CHART_NAME });
		const label = await chart
			.getByText(season.name, { exact: true })
			.boundingBox();
		const plot = await chart.boundingBox();
		if (!label || !plot) throw new Error("chart not laid out");

		// Hover above the season's x-axis label, inside the plot area.
		await page.mouse.move(label.x + label.width / 2, plot.y + plot.height / 2);

		const tooltip = page.getByRole("status").filter({ hasText: season.name });
		await expect(tooltip).toBeVisible();
		for (const [label, count] of [
			["Spielberechtigt gesamt", "3"],
			["Männlich", "1"],
			["Weiblich", "1"],
			["Alle Spieler", "4"],
		]) {
			await expect(
				tooltip.locator(".ts-chart-tooltip__row", { hasText: label }),
			).toHaveText(`${label}${count}`);
		}
	});
});

test.describe("Stats Route - Tournament Series & Placements", () => {
	test("shows a standalone tournament's placements grouped by category and sorted by rank, unranked last", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Standalone` },
		});
		const appointment = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}StandaloneAppt`,
				type: "TOURNAMENT",
			},
		});
		const first = await prismaClient.player.create({
			data: { name: `${PREFIX}First`, qttr: 1000, year: 2010 },
		});
		const second = await prismaClient.player.create({
			data: { name: `${PREFIX}Second`, qttr: 1000, year: 2010 },
		});
		const unranked = await prismaClient.player.create({
			data: { name: `${PREFIX}Unranked`, qttr: 1000, year: 2010 },
		});
		await prismaClient.placement.createMany({
			data: [
				{
					appointmentId: appointment.id,
					category: "Einzel",
					placement: "2",
					playerId: second.id,
				},
				{
					appointmentId: appointment.id,
					category: "Einzel",
					placement: null,
					playerId: unranked.id,
				},
				{
					appointmentId: appointment.id,
					category: "Einzel",
					placement: "1",
					playerId: first.id,
				},
			],
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		// Scope to the tournament's own article rather than the whole page, so
		// the assertion stays correct even once other page sections also render
		// player links.
		const node = page
			.getByRole("article")
			.filter({ hasText: appointment.title });
		await expect(node).toBeVisible();
		const playerLinks = node.locator('a[href*="/players/"]');
		await expect(playerLinks).toHaveText([
			first.name,
			second.name,
			unranked.name,
		]);
	});

	// A series is the FULL connected graph reachable via
	// nextAppointmentId/previousAppointments, not just the appointment(s) that
	// happen to fall in the selected season — selecting either linked
	// appointment's season shows the whole series, and the "Diese Saison"
	// marker follows whichever node actually matches the selected season.
	test("shows every linked appointment in the series, in every season, once any one of them falls in the selected season", async ({
		page,
	}) => {
		const earlierSeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}SeriesEarlier` },
		});
		const laterSeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}SeriesLater` },
		});
		const laterAppointment = await prismaClient.appointment.create({
			data: {
				seasonId: laterSeason.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}SeriesLaterAppt`,
				type: "TOURNAMENT",
			},
		});
		const earlierAppointment = await prismaClient.appointment.create({
			data: {
				nextAppointmentId: laterAppointment.id,
				seasonId: earlierSeason.id,
				startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365),
				status: "PUBLISHED",
				title: `${PREFIX}SeriesEarlierAppt`,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "user");

		await page.goto(`/stats?seasonId=${earlierSeason.id}`);
		await page.waitForLoadState("networkidle");
		await expect(
			page.locator(":visible", { hasText: earlierAppointment.title }).first(),
		).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: laterAppointment.title }).first(),
		).toBeVisible();
		await expect(
			page
				.getByRole("article")
				.filter({ hasText: earlierAppointment.title })
				.getByText("Diese Saison"),
		).toBeVisible();
		await expect(
			page
				.getByRole("article")
				.filter({ hasText: laterAppointment.title })
				.getByText("Diese Saison"),
		).toHaveCount(0);

		await page.goto(`/stats?seasonId=${laterSeason.id}`);
		await page.waitForLoadState("networkidle");
		await expect(
			page.locator(":visible", { hasText: earlierAppointment.title }).first(),
		).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: laterAppointment.title }).first(),
		).toBeVisible();
		await expect(
			page
				.getByRole("article")
				.filter({ hasText: laterAppointment.title })
				.getByText("Diese Saison"),
		).toBeVisible();
		await expect(
			page
				.getByRole("article")
				.filter({ hasText: earlierAppointment.title })
				.getByText("Diese Saison"),
		).toHaveCount(0);
	});

	// nextAppointmentId is a single scalar FK (an appointment has at most one
	// forward link), but nothing stops several different appointments from
	// pointing at the SAME next appointment — that's how a series branches.
	test("shows every branch of a series that converges into one appointment, with each node's own placements", async ({
		page,
	}) => {
		const qualifierSeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}BranchQualifier` },
		});
		const finalSeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}BranchFinal` },
		});
		const final = await prismaClient.appointment.create({
			data: {
				seasonId: finalSeason.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}BranchFinalAppt`,
				type: "TOURNAMENT",
			},
		});
		const qualifierA = await prismaClient.appointment.create({
			data: {
				nextAppointmentId: final.id,
				seasonId: qualifierSeason.id,
				startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
				status: "PUBLISHED",
				title: `${PREFIX}BranchQualifierNord`,
				type: "TOURNAMENT",
			},
		});
		const qualifierB = await prismaClient.appointment.create({
			data: {
				nextAppointmentId: final.id,
				seasonId: qualifierSeason.id,
				startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20),
				status: "PUBLISHED",
				title: `${PREFIX}BranchQualifierSued`,
				type: "TOURNAMENT",
			},
		});
		const qualifierAWinner = await prismaClient.player.create({
			data: { name: `${PREFIX}QualifierAWinner`, qttr: 1000, year: 2010 },
		});
		await prismaClient.placement.create({
			data: {
				appointmentId: qualifierA.id,
				category: "Einzel",
				placement: "1",
				playerId: qualifierAWinner.id,
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${qualifierSeason.id}`);
		await page.waitForLoadState("networkidle");

		for (const title of [qualifierA.title, qualifierB.title, final.title]) {
			await expect(
				page.locator(":visible", { hasText: title }).first(),
			).toBeVisible();
		}

		// Every node's own placements are visible without selecting anything.
		await expect(
			page
				.getByRole("article")
				.filter({ hasText: qualifierA.title })
				.getByText(qualifierAWinner.name),
		).toBeVisible();

		await page.goto(`/stats?seasonId=${finalSeason.id}`);
		await page.waitForLoadState("networkidle");
		for (const title of [qualifierA.title, qualifierB.title, final.title]) {
			await expect(
				page.locator(":visible", { hasText: title }).first(),
			).toBeVisible();
		}
	});

	// Nothing in the app prevents an editor from linking two appointments into
	// a loop (EditableNextAppointmentCard only disables picking an appointment
	// as its own next, not an indirect cycle created across two separate
	// edits). The diagram's client-side layout must not infinitely
	// recurse or crash the page when that happens.
	test("does not crash on a cyclic nextAppointmentId link between two appointments", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Cycle` },
		});
		const first = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}CycleFirst`,
				type: "TOURNAMENT",
			},
		});
		const second = await prismaClient.appointment.create({
			data: {
				nextAppointmentId: first.id,
				seasonId: season.id,
				startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
				status: "PUBLISHED",
				title: `${PREFIX}CycleSecond`,
				type: "TOURNAMENT",
			},
		});
		await prismaClient.appointment.update({
			data: { nextAppointmentId: second.id },
			where: { id: first.id },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(
			page.locator(":visible", { hasText: first.title }).first(),
		).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: second.title }).first(),
		).toBeVisible();
	});

	test("renders two appointments from the same series in the same season as separate entries", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}SameSeasonSeries` },
		});
		const second = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}SameSeasonSecond`,
				type: "TOURNAMENT",
			},
		});
		const first = await prismaClient.appointment.create({
			data: {
				nextAppointmentId: second.id,
				seasonId: season.id,
				startDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
				status: "PUBLISHED",
				title: `${PREFIX}SameSeasonFirst`,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(
			page.locator(":visible", { hasText: first.title }).first(),
		).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: second.title }).first(),
		).toBeVisible();
	});

	test("shows a tab per series and switches the shown tournaments when another tab is picked", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}TwoSeries` },
		});
		const one = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}TabSeriesOne`,
				type: "TOURNAMENT",
			},
		});
		const two = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
				status: "PUBLISHED",
				title: `${PREFIX}TabSeriesTwo`,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		// Tabs are listed newest first, so the later series is selected initially.
		await expect(page.getByRole("tab")).toHaveCount(2);
		await expect(
			page.getByRole("article").filter({ hasText: two.title }),
		).toBeVisible();
		await expect(
			page.getByRole("article").filter({ hasText: one.title }),
		).toHaveCount(0);

		await page.getByRole("tab", { name: one.title }).click();
		await expect(
			page.getByRole("article").filter({ hasText: one.title }),
		).toBeVisible();
		await expect(
			page.getByRole("article").filter({ hasText: two.title }),
		).toHaveCount(0);
	});

	test("a season with no qualifying tournaments shows an empty state instead of an error", async ({
		page,
	}) => {
		const emptySeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}NoTournaments` },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${emptySeason.id}`);
		await page.waitForLoadState("networkidle");

		await expect(
			page
				.locator(":visible", { hasText: "Keine Turniere in dieser Saison" })
				.first(),
		).toBeVisible();
	});
});

test.describe("Stats Route - Player Breakdown", () => {
	const SECTION = "Altersverteilung";
	const NO_DATA = "Keine Daten für diese Saison";
	const year = new Date().getFullYear();

	// "dd.mm.yyyy" in the club's time zone, as the Stand note renders it.
	const standNote = (computedAt: Date) =>
		`Stand: ${computedAt.toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			timeZone: "Europe/Berlin",
			year: "numeric",
		})}`;

	test.afterEach(cleanupFixtures);

	// Hovers above an age group's x-axis label and returns the tooltip.
	async function hoverAgeGroup(
		page: import("@playwright/test").Page,
		ageGroup: string,
	) {
		const chart = page.getByRole("img", { name: SECTION });
		// Mouse coordinates are viewport-relative, so the chart must be on screen.
		await chart.scrollIntoViewIfNeeded();
		const label = await chart
			.getByText(ageGroup, { exact: true })
			.boundingBox();
		const plot = await chart.boundingBox();
		if (!label || !plot) throw new Error("chart not laid out");
		await page.mouse.move(label.x + label.width / 2, plot.y + plot.height / 2);
		const tooltip = page.getByRole("status").filter({ hasText: ageGroup });
		await expect(tooltip).toBeVisible();
		return tooltip;
	}

	// The tooltip row whose label is exactly `label`, e.g. "Männlich" but not
	// "Männlich (nicht spielberechtigt)".
	const tooltipRow = (
		tooltip: import("@playwright/test").Locator,
		label: string,
	) =>
		tooltip.locator(".ts-chart-tooltip__row").filter({
			hasText: new RegExp(`^${label.replace(/[()]/g, "\\$&")}\\d+$`),
		});

	test("shows the seeded Active Season's stored breakdown with its Stand note", async ({
		page,
	}) => {
		// prisma/seed.ts: two Players without a gender, born 2010 and 2011, one of
		// them eligible, so each Player's age group has one of each.
		const active = await prismaClient.season.findFirstOrThrow({
			include: { statistics: true },
			where: { isActive: true },
		});
		const computedAt = active.statistics?.computedAt;
		if (!computedAt) throw new Error("seed has no Active Season record");
		const ageGroup = calculateAgeGroup(2010, year);

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		await expect(page.getByText(SECTION, { exact: true })).toBeVisible();
		await expect(page.getByText(standNote(computedAt))).toBeVisible();
		await expect(page.getByText(NO_DATA)).toHaveCount(0);
		const tooltip = await hoverAgeGroup(
			page,
			ageGroup === "ADULT" ? "Erwachsen" : ageGroup,
		);
		await expect(tooltipRow(tooltip, "Unbekannt")).toHaveText(
			/^Unbekannt[01]$/,
		);
		await expect(
			tooltipRow(tooltip, "Unbekannt (nicht spielberechtigt)"),
		).toHaveText(/^Unbekannt \(nicht spielberechtigt\)[01]$/);
	});

	test("follows the season selector and shows real, not cumulative, counts", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}BreakdownTracked` },
		});
		// 3 eligible + 2 not-eligible adult men, 1 eligible adult woman, 4 not
		// eligible U13 players without a gender.
		const players = [
			...Array.from({ length: 3 }, () => ({
				e: true,
				g: "MALE" as const,
				y: 40,
			})),
			...Array.from({ length: 2 }, () => ({
				e: false,
				g: "MALE" as const,
				y: 40,
			})),
			{ e: true, g: "FEMALE" as const, y: 40 },
			...Array.from({ length: 4 }, () => ({ e: false, g: null, y: 12 })),
		].map((p) => ({
			gender: p.g,
			isEligibleToPlay: p.e,
			year: year - p.y,
		}));
		const computedAt = new Date("2025-03-07T12:00:00Z");
		await prismaClient.seasonStatistics.create({
			data: {
				breakdown: buildAgeGroupBreakdown(players, year),
				computedAt,
				eligibleCount: 4,
				eligibleFemaleCount: 1,
				eligibleMaleCount: 3,
				playerCount: players.length,
				seasonId: season.id,
			},
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");
		await page.locator('[data-slot="select-trigger"]:visible').click();
		await page.getByRole("option", { name: season.name }).click();
		await page.waitForURL(new RegExp(`seasonId=${season.id}`));
		await page.waitForLoadState("networkidle");

		await expect(page.getByText("Stand: 07.03.2025")).toBeVisible();
		const adults = await hoverAgeGroup(page, "Erwachsen");
		await expect(tooltipRow(adults, "Männlich")).toHaveText("Männlich3");
		await expect(
			tooltipRow(adults, "Männlich (nicht spielberechtigt)"),
		).toHaveText("Männlich (nicht spielberechtigt)2");
		await expect(tooltipRow(adults, "Weiblich")).toHaveText("Weiblich1");
		const youth = await hoverAgeGroup(page, "U13");
		await expect(
			tooltipRow(youth, "Unbekannt (nicht spielberechtigt)"),
		).toHaveText("Unbekannt (nicht spielberechtigt)4");
	});

	test("shows the six series in the legend", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const chart = page.getByRole("img", { name: SECTION });
		for (const label of [
			"Männlich",
			"Männlich (nicht spielberechtigt)",
			"Weiblich",
			"Weiblich (nicht spielberechtigt)",
			"Unbekannt",
			"Unbekannt (nicht spielberechtigt)",
		]) {
			await expect(chart.getByText(label, { exact: true })).toBeVisible();
		}
	});

	test("a past Season whose breakdown is not tracked shows the empty state", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}BreakdownUntracked` },
		});
		await prismaClient.seasonStatistics.create({
			data: {
				eligibleCount: 5,
				eligibleFemaleCount: 2,
				eligibleMaleCount: 3,
				seasonId: season.id,
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(page.getByText(SECTION, { exact: true })).toBeVisible();
		await expect(page.getByText(NO_DATA)).toBeVisible();
		await expect(page.getByRole("img", { name: SECTION })).toHaveCount(0);
		await expect(page.getByText(/^Stand:/)).toHaveCount(0);
	});

	test("a Season without any stored record shows the empty state instead of an error", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}BreakdownNoRecord` },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(page.getByText(NO_DATA)).toBeVisible();
	});
});

test.describe("Stats Route - Player Count Chart", () => {
	// prisma/seed.ts: two Players, only one of them eligible, neither with a
	// gender, so the Active Season's stored record is 1 / 0 / 0 / 2.
	test("shows the seeded Active Season's stored Eligible Player counts", async ({
		page,
	}) => {
		const activeSeason = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const chart = page.getByRole("img", {
			name: "Spielerzahl im Saisonvergleich",
		});
		await chart.scrollIntoViewIfNeeded();
		const label = await chart
			.getByText(activeSeason.name, { exact: true })
			.boundingBox();
		const plot = await chart.boundingBox();
		if (!label || !plot) throw new Error("chart not laid out");
		await page.mouse.move(label.x + label.width / 2, plot.y + plot.height / 2);

		const tooltip = page
			.getByRole("status")
			.filter({ hasText: activeSeason.name });
		await expect(tooltip).toBeVisible();
		for (const [series, count] of [
			["Spielberechtigt gesamt", "1"],
			["Männlich", "0"],
			["Weiblich", "0"],
			["Alle Spieler", "2"],
		]) {
			await expect(
				tooltip.locator(".ts-chart-tooltip__row", { hasText: series }),
			).toHaveText(`${series}${count}`);
		}
	});
});

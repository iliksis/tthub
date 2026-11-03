import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
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
	// Scoped to a visible `<tr>`; the season name also appears in the season
	// selector and the chart.
	const countCells = (
		page: import("@playwright/test").Page,
		seasonName: string,
	) => page.locator("tr:visible", { hasText: seasonName }).locator("td");

	test("counts rostered-only, placed-only, and both as Season Players without double counting", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}CountUnion` },
		});
		const team = await prismaClient.team.create({
			data: { seasonId: season.id, title: `${PREFIX}CountTeam` },
		});
		const [rosterOnly, placedOnly, both] = await Promise.all(
			(
				[
					["RosterOnly", "MALE"],
					["PlacedOnly", null],
					["Both", "FEMALE"],
				] as const
			).map(([n, gender]) =>
				prismaClient.player.create({
					data: { gender, name: `${PREFIX}${n}`, qttr: 1000, year: 2010 },
				}),
			),
		);
		for (const p of [rosterOnly, both]) {
			await prismaClient.teamPlayer.create({
				data: { playerId: p.id, seasonId: season.id, teamId: team.id },
			});
		}
		const appointment = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}CountAppt`,
				type: "TOURNAMENT",
			},
		});
		// "both" is placed twice (two categories) on top of being rostered.
		await prismaClient.placement.createMany({
			data: [
				{
					appointmentId: appointment.id,
					category: "Einzel",
					placement: "1",
					playerId: placedOnly.id,
				},
				{
					appointmentId: appointment.id,
					category: "Einzel",
					placement: "2",
					playerId: both.id,
				},
				{
					appointmentId: appointment.id,
					category: "Doppel",
					placement: "2",
					playerId: both.id,
				},
			],
		});

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		await expect(countCells(page, season.name)).toHaveText([
			season.name,
			"3",
			"1",
			"1",
		]);
	});

	test("lists every season in chronological order and ignores the season selector", async ({
		page,
	}) => {
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

		await loginAs(page, "user");
		await page.goto("/stats");
		await page.waitForLoadState("networkidle");

		const names = await page
			.locator("tr:visible td:first-child")
			.allTextContents();
		const olderIdx = names.indexOf(older.name);
		expect(olderIdx).toBeGreaterThanOrEqual(0);
		expect(names.indexOf(newer.name)).toBeGreaterThan(olderIdx);

		await page.goto(`/stats?seasonId=${older.id}`);
		await page.waitForLoadState("networkidle");
		const namesAfter = await page
			.locator("tr:visible td:first-child")
			.allTextContents();
		expect(namesAfter).toContain(older.name);
		expect(namesAfter).toContain(newer.name);
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

		await expect(
			page.getByRole("article").filter({ hasText: one.title }),
		).toBeVisible();
		await expect(
			page.getByRole("article").filter({ hasText: two.title }),
		).toHaveCount(0);

		await page.getByRole("tab", { name: two.title }).click();
		await expect(
			page.getByRole("article").filter({ hasText: two.title }),
		).toBeVisible();
		await expect(
			page.getByRole("article").filter({ hasText: one.title }),
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

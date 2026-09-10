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

test.describe("Stats Route - Participating Players per Team", () => {
	// The same Team title also appears in the League/Placement table's row on
	// this page, so matching on the title alone is ambiguous. Scoping to a
	// visible `<tr>` containing both the title and the expected ratio
	// disambiguates it from that other table's row (which never contains a
	// ratio) without needing the mobile tree's `<a>` row at all.
	const ratioRow = (
		page: import("@playwright/test").Page,
		teamTitle: string,
		ratio: string,
	) =>
		page
			.locator("tr:visible", { hasText: teamTitle })
			.filter({ hasText: ratio });

	test("counts a rostered player with a Placement on any tournament, but not a rostered player with no Placement", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Roster` },
		});
		const team = await prismaClient.team.create({
			data: { seasonId: season.id, title: `${PREFIX}RosterTeam` },
		});
		const label = await prismaClient.label.create({
			data: {
				color: "peach",
				name: `${PREFIX}RosterLabel`,
			},
		});

		const placedPlayer = await prismaClient.player.create({
			data: { name: `${PREFIX}Placed`, qttr: 1000, year: 2010 },
		});
		const unplacedPlayer = await prismaClient.player.create({
			data: { name: `${PREFIX}Unplaced`, qttr: 1000, year: 2010 },
		});
		await prismaClient.teamPlayer.create({
			data: { playerId: placedPlayer.id, seasonId: season.id, teamId: team.id },
		});
		await prismaClient.teamPlayer.create({
			data: {
				playerId: unplacedPlayer.id,
				seasonId: season.id,
				teamId: team.id,
			},
		});

		const appointment = await prismaClient.appointment.create({
			data: {
				labels: { create: { labelId: label.id } },
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}RosterAppt`,
				type: "TOURNAMENT",
			},
		});
		await prismaClient.placement.create({
			data: {
				appointmentId: appointment.id,
				category: "Einzel",
				placement: "1",
				playerId: placedPlayer.id,
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(ratioRow(page, team.title, "1/2")).toBeVisible();
	});

	test("shows 0/0 for a team with no roster", async ({ page }) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}EmptyRoster` },
		});
		const team = await prismaClient.team.create({
			data: { seasonId: season.id, title: `${PREFIX}EmptyRosterTeam` },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(ratioRow(page, team.title, "0/0")).toBeVisible();
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

		const titleLink = page
			.locator(":visible a", { hasText: appointment.title })
			.first();
		await expect(titleLink).toBeVisible();

		// Scope to the tournament card (the title link's parent) rather than the
		// whole page, so the assertion stays correct even once other page
		// sections also render player links.
		const card = titleLink.locator("xpath=..");
		const playerLinks = card.locator('a[href*="/players/"]');
		await expect(playerLinks).toHaveText([
			first.name,
			second.name,
			unranked.name,
		]);
	});

	test("scopes a linked series to only the appointment(s) that fall in the selected season", async ({
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
				startDate: new Date(),
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
		await expect(page.locator(`text=${laterAppointment.title}`)).toHaveCount(0);

		await page.goto(`/stats?seasonId=${laterSeason.id}`);
		await page.waitForLoadState("networkidle");

		await expect(
			page.locator(":visible", { hasText: laterAppointment.title }).first(),
		).toBeVisible();
		await expect(page.locator(`text=${earlierAppointment.title}`)).toHaveCount(
			0,
		);
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

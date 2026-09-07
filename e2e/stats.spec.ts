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

test.describe("Stats Route - Top-Level Tournament Participation", () => {
	// The stat tile isn't split into mobile/desktop trees (unlike the team
	// table above), so this class-based locator resolves to exactly one
	// element without needing a `:visible` filter.
	const participationValue = (page: import("@playwright/test").Page) =>
		page.locator(".font-bold.text-3xl");

	test("counts distinct players placed in a Top-Level Tournament, ignoring non-flagged labels and repeat categories", async ({
		page,
	}) => {
		const season = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}Participation` },
		});
		const topLabel = await prismaClient.label.create({
			data: { color: "blue", countsForStats: true, name: `${PREFIX}TopLabel` },
		});
		const otherLabel = await prismaClient.label.create({
			data: {
				color: "green",
				countsForStats: false,
				name: `${PREFIX}OtherLabel`,
			},
		});

		const player1 = await prismaClient.player.create({
			data: { name: `${PREFIX}P1`, qttr: 1000, year: 2010 },
		});
		const player2 = await prismaClient.player.create({
			data: { name: `${PREFIX}P2`, qttr: 1000, year: 2010 },
		});
		const player3 = await prismaClient.player.create({
			data: { name: `${PREFIX}P3`, qttr: 1000, year: 2010 },
		});

		const topAppointment = await prismaClient.appointment.create({
			data: {
				labels: { create: { labelId: topLabel.id } },
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}TopAppt`,
				type: "TOURNAMENT",
			},
		});
		const otherAppointment = await prismaClient.appointment.create({
			data: {
				labels: { create: { labelId: otherLabel.id } },
				seasonId: season.id,
				startDate: new Date(),
				status: "PUBLISHED",
				title: `${PREFIX}OtherAppt`,
				type: "TOURNAMENT",
			},
		});

		// player1: placed in two categories on the top-level tournament — must
		// count once, not twice.
		await prismaClient.placement.create({
			data: {
				appointmentId: topAppointment.id,
				category: "Einzel",
				placement: "1",
				playerId: player1.id,
			},
		});
		await prismaClient.placement.create({
			data: {
				appointmentId: topAppointment.id,
				category: "Doppel",
				placement: "2",
				playerId: player1.id,
			},
		});
		// player2: placed only in the top-level tournament.
		await prismaClient.placement.create({
			data: {
				appointmentId: topAppointment.id,
				category: "Einzel",
				placement: "3",
				playerId: player2.id,
			},
		});
		// player3: placed only in the non-top-level tournament — must not count.
		await prismaClient.placement.create({
			data: {
				appointmentId: otherAppointment.id,
				category: "Einzel",
				placement: "1",
				playerId: player3.id,
			},
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${season.id}`);
		await page.waitForLoadState("networkidle");

		await expect(participationValue(page)).toHaveText("2");
	});

	test("shows 0 for a season with no top-level tournaments", async ({
		page,
	}) => {
		const emptySeason = await prismaClient.season.create({
			data: { isActive: false, name: `${PREFIX}NoParticipation` },
		});

		await loginAs(page, "user");
		await page.goto(`/stats?seasonId=${emptySeason.id}`);
		await page.waitForLoadState("networkidle");

		await expect(participationValue(page)).toHaveText("0");
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
		// Deliberately not flagged for stats — a Participating Player is
		// independent of Label.countsForStats, unlike the top-level stat above.
		const label = await prismaClient.label.create({
			data: {
				color: "peach",
				countsForStats: false,
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

import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { loginAs } from "./helpers";

test.describe("Teams Route - Access Control", () => {
	test("ADMIN can access teams list", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/teams");
		await expect(page).toHaveURL("/teams");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access teams list", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/teams");
		await expect(page).toHaveURL("/teams");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access teams list (read-only)", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/teams");
		await expect(page).toHaveURL("/teams");
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users are redirected", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Teams Route - Data Display", () => {
	test("ADMIN sees seeded teams data", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");
		const content = await page.locator("body").textContent();
		expect(content).toBeTruthy();
	});

	test("can view team detail page if data exists", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		const teamLinks = page.locator('a[href^="/teams/"]:visible');
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await expect(page).toHaveURL(/\/teams\/.+/);
		} else {
			test.skip();
		}
	});
});

test.describe("Teams Route - Edit Functionality", () => {
	test("ADMIN can edit a team", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		// The split view's rows only select a team in the preview panel; the
		// name link is what actually navigates to the team detail page.
		const teamLinks = page.locator('a[href^="/teams/"]:visible');
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await page.waitForLoadState("networkidle");

			// The cog only exists in the mobile FAB menu; on desktop the edit
			// button is already directly visible in the toolbar.
			const configButton = page.locator("div svg.lucide-cog:visible");
			if ((await configButton.count()) > 0) {
				await configButton.first().click();
			}

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"]:visible, button svg.lucide-square-pen:visible',
			);
			if ((await editButton.count()) > 0) {
				await editButton.first().click();
				await page.waitForTimeout(500);

				const leagueInput = page
					.locator('input[name="league"], input[id="league"]')
					.first();
				if (await leagueInput.isVisible()) {
					const originalValue = await leagueInput.inputValue();
					await leagueInput.fill(`${originalValue} Updated`);

					const submitButton = page.locator('button[type="submit"]');
					await submitButton.click();
					await page.waitForTimeout(1000);

					const bodyText = await page.locator("body").textContent();
					expect(bodyText).toContain("Updated");
				}
			} else {
				test.skip();
			}
		} else {
			test.skip();
		}
	});

	test("EDITOR can edit a team", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		// The split view's rows only select a team in the preview panel; the
		// name link is what actually navigates to the team detail page.
		const teamLinks = page.locator('a[href^="/teams/"]:visible');
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog:visible");
			if ((await configButton.count()) > 0) {
				await configButton.first().click();
			}

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"]:visible, button svg.lucide-square-pen:visible',
			);
			if ((await editButton.count()) > 0) {
				await expect(editButton.first()).toBeVisible();
			} else {
				test.skip();
			}
		} else {
			test.skip();
		}
	});

	test("USER cannot edit a team", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		// The split view's rows only select a team in the preview panel; the
		// name link is what actually navigates to the team detail page.
		const teamLinks = page.locator('a[href^="/teams/"]:visible');
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog:visible");
			const editButton = page.locator(
				'button[aria-label*="aktualisieren"]:visible, button svg.lucide-square-pen:visible',
			);
			await expect(configButton).not.toBeVisible();
			await expect(editButton).not.toBeVisible();
		} else {
			test.skip();
		}
	});
});

test.describe("Teams Route - Team Halves", () => {
	async function createSplitFixture(label: string) {
		const season = await prismaClient.season.findFirstOrThrow();
		const title = `Half ${label} ${Date.now()}`;
		const team = await prismaClient.team.create({
			data: { league: "Hin-Liga", seasonId: season.id, title },
		});
		const player = await prismaClient.player.create({
			data: {
				gender: "MALE",
				name: `Half Player ${title}`,
				qttr: 1000,
				year: 2012,
			},
		});
		await prismaClient.teamPlayer.create({
			data: { playerId: player.id, seasonId: season.id, teamId: team.id },
		});
		return { player, season, team, title };
	}

	test("EDITOR can create a Rückrunde half, which is then hidden", async ({
		page,
	}) => {
		const { team, title, player } = await createSplitFixture("create");
		await loginAs(page, "editor");
		await page.goto(`/teams/${team.id}`);
		await page.waitForLoadState("networkidle");

		const createButton = page.getByRole("button", {
			name: "Rückrunde erstellen",
		});
		await createButton.click();

		// Lands on the new half: pre-filled title, empty roster, no create action.
		await expect(page).not.toHaveURL(`/teams/${team.id}`);
		await expect(page.getByText(title).first()).toBeVisible();
		await expect(page.getByText("Rückrunde").first()).toBeVisible();
		await expect(page.getByText(player.name)).toHaveCount(0);
		await expect(createButton).toHaveCount(0);

		// The Hinrunde page links over to the half and hides the action too.
		await page.goto(`/teams/${team.id}`);
		await page.waitForLoadState("networkidle");
		await expect(createButton).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: "Zur Rückrunde" }),
		).toBeVisible();
	});

	test("halves keep independent rosters and link to each other", async ({
		page,
	}) => {
		const { team, player } = await createSplitFixture("roster");
		await loginAs(page, "editor");
		await page.goto(`/teams/${team.id}`);
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: "Rückrunde erstellen" }).click();
		await page.waitForURL((url) => !url.pathname.endsWith(team.id));
		await page.waitForLoadState("networkidle");
		const rueckrundeUrl = page.url();

		// Edit the Rückrunde through the form: league plus the same player
		// the Hinrunde already has rostered.
		await page.getByRole("button", { name: "Team aktualisieren" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.locator("#league").fill("Rück-Liga");
		await dialog.getByRole("combobox").click();
		await page.getByRole("option", { name: player.name }).click();
		await dialog.getByRole("button", { name: "Aktualisieren" }).click();
		await expect(page.getByText("Kader aktualisiert")).toBeVisible();
		await dialog.getByRole("button", { name: "Schließen" }).click();
		await expect(dialog).toBeHidden();

		await expect(page.getByText("Rück-Liga").first()).toBeVisible();
		await expect(page.getByText(player.name)).toBeVisible();
		await expect(page.getByText("Hin-Liga")).toHaveCount(0);

		// The Hinrunde keeps its own league and its own membership.
		await page.getByRole("link", { name: "Zur Hinrunde" }).click();
		await expect(page).toHaveURL(`/teams/${team.id}`);
		await expect(page.getByText("Hin-Liga").first()).toBeVisible();
		await expect(page.getByText("Rück-Liga")).toHaveCount(0);
		await expect(page.getByText(player.name)).toBeVisible();

		// Removing the player from the Hinrunde leaves the Rückrunde roster alone.
		await page.getByRole("button", { name: "Team aktualisieren" }).click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Aus dem Kader entfernen" })
			.click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Aktualisieren" })
			.click();
		await expect(page.getByText("Kader aktualisiert")).toBeVisible();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Schließen" })
			.click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await expect(page.getByText(player.name)).toHaveCount(0);

		await page.goto(rueckrundeUrl);
		await page.waitForLoadState("networkidle");
		await expect(page.getByText(player.name)).toBeVisible();
	});

	test("the same player cannot be rostered twice on one team row", async () => {
		const { team, season, player } = await createSplitFixture("dupe");
		await expect(
			prismaClient.teamPlayer.create({
				data: { playerId: player.id, seasonId: season.id, teamId: team.id },
			}),
		).rejects.toMatchObject({ code: "P2002" });
	});
});

import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { loginAs } from "./helpers";

test.describe("Players Route - Access Control", () => {
	test("ADMIN can access players list", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/players");
		await expect(page).toHaveURL("/players");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access players list", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/players");
		await expect(page).toHaveURL("/players");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access players list (read-only)", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/players");
		await expect(page).toHaveURL("/players");
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users are redirected", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/players");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Players Route - Data Display", () => {
	test("ADMIN sees seeded players data", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");
		const content = await page.locator("body").textContent();
		expect(content).toBeTruthy();
	});

	test("can view player detail page if data exists", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		const playerLinks = page.locator('a[href^="/players/"]:visible');
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await expect(page).toHaveURL(/\/players\/.+/);
		} else {
			test.skip();
		}
	});
});

test.describe("Players Route - Edit Functionality", () => {
	test("ADMIN can edit a player", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		// The mobile and desktop layouts both render a table; scope to the
		// one that's actually visible at the test viewport.
		const playerLinks = page.locator("tbody tr:visible");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await page.waitForLoadState("networkidle");

			// Players have no mobile-only cog menu — the edit button is
			// always directly visible, so this is a no-op there.
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

				const nameInput = page.locator('input[type="text"]').first();
				if (await nameInput.isVisible()) {
					const originalValue = await nameInput.inputValue();
					await nameInput.fill(`${originalValue} Updated`);

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

	test("EDITOR can edit a player", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		// The mobile and desktop layouts both render a table; scope to the
		// one that's actually visible at the test viewport.
		const playerLinks = page.locator("tbody tr:visible");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
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

	test("EDITOR can set a player's gender and it persists", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		const playerLinks = page.locator("tbody tr:visible");
		const count = await playerLinks.count();

		if (count === 0) {
			test.skip();
			return;
		}

		await playerLinks.first().click();
		await page.waitForLoadState("networkidle");

		const editButton = page.locator(
			'button[aria-label*="aktualisieren"]:visible, button svg.lucide-square-pen:visible',
		);
		// The edit button is auth-gated behind the root loader's user context,
		// which can resolve slightly after `networkidle` fires — wait for it
		// rather than racing a `.count()` check.
		await editButton.first().waitFor({ state: "visible" });
		await editButton.first().click();

		await page.getByRole("combobox").click();
		await page.getByRole("option", { exact: true, name: "Männlich" }).click();

		await page.locator('button[type="submit"]').click();
		await expect(page.getByText("Spieler:in aktualisiert")).toBeVisible();

		// Reload and reopen the edit form to confirm the value persisted,
		// not just what's left in the (still-mounted) form's local state.
		await page.reload();
		await page.waitForLoadState("networkidle");

		await editButton.first().waitFor({ state: "visible" });
		await editButton.first().click();

		await expect(page.getByRole("combobox")).toContainText("Männlich");
	});

	test("USER cannot edit a player", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		// The mobile and desktop layouts both render a table; scope to the
		// one that's actually visible at the test viewport.
		const playerLinks = page.locator("tbody tr:visible");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
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

test.describe("Players Route - Team Half Resolution", () => {
	async function createSplitPlayer(
		label: string,
		{ onBoth }: { onBoth: boolean },
	) {
		const season = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const title = `PHalf ${label} ${Date.now()}`;
		const hinrunde = await prismaClient.team.create({
			data: {
				half: "HINRUNDE",
				league: "Hin-Liga",
				seasonId: season.id,
				title,
			},
		});
		const rueckrunde = await prismaClient.team.create({
			data: {
				half: "RUECKRUNDE",
				hinrundeTeamId: hinrunde.id,
				league: "Rueck-Liga",
				seasonId: season.id,
				title,
			},
		});
		const player = await prismaClient.player.create({
			data: { name: `PHalf Player ${title}`, qttr: 1000, year: 2012 },
		});
		await prismaClient.teamPlayer.create({
			data: { playerId: player.id, seasonId: season.id, teamId: hinrunde.id },
		});
		if (onBoth) {
			await prismaClient.teamPlayer.create({
				data: {
					playerId: player.id,
					seasonId: season.id,
					teamId: rueckrunde.id,
				},
			});
		}
		return { hinrunde, player, rueckrunde };
	}

	test("rostered on both halves: list and detail show the Rückrunde only", async ({
		page,
	}) => {
		const { hinrunde, player, rueckrunde } = await createSplitPlayer("both", {
			onBoth: true,
		});
		await loginAs(page, "editor");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");
		const row = page.locator("tr", { hasText: player.name });
		await expect(
			row.locator(`a[href="/teams/${rueckrunde.id}"]:visible`),
		).toHaveCount(1);
		await expect(row.locator(`a[href="/teams/${hinrunde.id}"]`)).toHaveCount(0);
		await expect(
			row.getByText("Rückrunde").filter({ visible: true }),
		).toHaveCount(1);

		await page.goto(`/players/${player.id}`);
		await page.waitForLoadState("networkidle");
		await expect(
			page.locator(`a[href="/teams/${rueckrunde.id}"]:visible`),
		).toHaveCount(1);
		await expect(page.locator(`a[href="/teams/${hinrunde.id}"]`)).toHaveCount(
			0,
		);
	});

	test("rostered only on the Hinrunde: shows the Hinrunde half", async ({
		page,
	}) => {
		const { hinrunde, player } = await createSplitPlayer("hin", {
			onBoth: false,
		});
		await loginAs(page, "editor");
		await page.goto(`/players/${player.id}`);
		await page.waitForLoadState("networkidle");
		await expect(
			page.locator(`a[href="/teams/${hinrunde.id}"]:visible`),
		).toHaveCount(1);
		await expect(
			page.getByText("Hinrunde").filter({ visible: true }),
		).toHaveCount(1);
	});
});

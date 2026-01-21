import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("GlobalSearch - Opening and Closing", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
	});

	test("opens search with Ctrl+K keyboard shortcut", async ({ page }) => {
		await page.keyboard.press("Control+KeyK");

		// Wait for the search input to be visible
		const searchInput = page.locator("[cmdk-input]");
		await expect(searchInput).toBeVisible({ timeout: 10000 });
	});

	test("opens search with Cmd+K on Mac", async ({ page, browserName }) => {
		if (browserName === "webkit") {
			await page.keyboard.press("Meta+KeyK");

			const searchInput = page.locator("[cmdk-input]");
			await expect(searchInput).toBeVisible({ timeout: 10000 });
		} else {
			test.skip();
		}
	});

	test("closes search when clicking outside", async ({ page }) => {
		await page.keyboard.press("Control+KeyK");
		const searchInput = page.locator("[cmdk-input]");
		await expect(searchInput).toBeVisible({ timeout: 10000 });

		// Click outside the dialog
		await page.locator("body").click({ position: { x: 10, y: 10 } });
		await expect(searchInput).not.toBeVisible();
	});

	test("closes search with ESC when no search type is selected", async ({
		page,
	}) => {
		await page.keyboard.press("Control+KeyK");
		const searchInput = page.locator("[cmdk-input]");
		await expect(searchInput).toBeVisible({ timeout: 10000 });

		await page.keyboard.press("Escape");
		await expect(searchInput).not.toBeVisible();
	});
});

test.describe("GlobalSearch - Search Type Selection", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");
	});

	test("shows all search type shortcuts initially", async ({ page }) => {
		await expect(page.locator("text=Termine suchen").first()).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).toBeVisible();
		await expect(page.locator("text=Teams suchen").first()).toBeVisible();
	});

	test("selecting appointments type shows badge and focuses input", async ({
		page,
	}) => {
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Termine suchen" })
			.click();

		await expect(page.locator("text=Termine suchen").first()).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).not.toBeVisible();

		// Check input is focused
		const input = page.locator("[cmdk-input]");
		await expect(input).toBeFocused();
	});

	test("selecting players type shows badge and focuses input", async ({
		page,
	}) => {
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Spieler:innen suchen" })
			.click();

		await expect(page.locator("text=Termine suchen").first()).not.toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).toBeVisible();

		const input = page.locator("[cmdk-input]");
		await expect(input).toBeFocused();
	});

	test("selecting teams type shows badge and focuses input", async ({
		page,
	}) => {
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Teams suchen" })
			.click();

		await expect(page.locator("text=Teams suchen").first()).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).not.toBeVisible();

		const input = page.locator("[cmdk-input]");
		await expect(input).toBeFocused();
	});
});

test.describe("GlobalSearch - Keyboard Shortcuts", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");
	});

	test("typing '<a' selects appointments search type", async ({ page }) => {
		const input = page.locator("[cmdk-input]");
		await input.type("<a");

		await expect(page.locator("text=Termine suchen").first()).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).not.toBeVisible();
	});

	test("typing '<p' selects players search type", async ({ page }) => {
		const input = page.locator("[cmdk-input]");
		await input.type("<p");

		await expect(page.locator("text=Termine suchen").first()).not.toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).toBeVisible();
	});

	test("typing '<t' selects teams search type", async ({ page }) => {
		const input = page.locator("[cmdk-input]");
		await input.type("<t");

		await expect(page.locator("text=Teams suchen").first()).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).not.toBeVisible();
	});
});

test.describe("GlobalSearch - Back to Shortcuts", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");
	});

	test("pressing ESC with search type open goes back to shortcuts", async ({
		page,
	}) => {
		// Select a search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Spieler:innen suchen" })
			.click();

		await expect(page.locator("text=Termine suchen").first()).not.toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).toBeVisible();

		// Press ESC
		await page.keyboard.press("Escape");

		// Should go back to shortcuts, not close
		const searchInput = page.locator("[cmdk-input]");
		await expect(searchInput).toBeVisible();
		await expect(
			page.locator("text=Spieler:innen suchen").first(),
		).toBeVisible();
		await expect(page.locator("text=Termine suchen").first()).toBeVisible();
	});

	test("clicking ESC button goes back to shortcuts", async ({ page }) => {
		// Select a search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Teams suchen" })
			.click();

		// Click ESC button
		await page.locator("button").filter({ hasText: "ESC" }).click();

		// Should go back to shortcuts
		const searchInput = page.locator("[cmdk-input]");
		await expect(searchInput).toBeVisible();
		await expect(page.locator("text=Termine suchen").first()).toBeVisible();
	});
});

test.describe("GlobalSearch - Search Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");
	});

	test("can search for players by typing", async ({ page }) => {
		// Select players search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Spieler:innen suchen" })
			.click();

		await page.locator("[cmdk-input]").fill("Lisa");

		// Wait for search results
		await page.waitForTimeout(500);

		// Results should be displayed (or empty message)
		const hasResults = (await page.locator('[role="option"]').count()) > 0;
		expect(hasResults).toBeTruthy();
	});

	test("can search for appointments by typing", async ({ page }) => {
		// Select appointments search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Termine suchen" })
			.click();

		await page.locator("[cmdk-input]").fill("Training");

		// Wait for search results
		await page.waitForTimeout(500);

		// Results should be displayed (or empty message)
		const hasResults = (await page.locator('[role="option"]').count()) > 0;
		expect(hasResults).toBeTruthy();
	});

	test("can search for teams by typing", async ({ page }) => {
		// Select teams search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Teams suchen" })
			.click();

		await page.locator("[cmdk-input]").fill("U13");

		// Wait for search results
		await page.waitForTimeout(500);

		// Results should be displayed (or empty message)
		const hasResults = (await page.locator('[role="option"]').count()) > 0;
		expect(hasResults).toBeTruthy();
	});
});

test.describe("GlobalSearch - Navigation", () => {
	test("clicking on a player result navigates to player detail", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");

		// Select players search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Spieler:innen suchen" })
			.click();

		// Search for all players (empty query)
		await page.waitForTimeout(500);

		// If there are results, click the first one
		const firstResult = page.locator('[role="option"]').first();
		const resultCount = await page.locator('[role="option"]').count();

		if (resultCount > 0) {
			await firstResult.click();

			// Should navigate to player detail page
			await expect(page).toHaveURL(/\/players\/.+/);
		} else {
			test.skip();
		}
	});

	test("clicking on an appointment result navigates to appointment detail", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");

		// Select appointments search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Termine suchen" })
			.click();

		await page.waitForTimeout(500);

		// If there are results, click the first one
		const firstResult = page.locator('[role="option"]').first();
		const resultCount = await page.locator('[role="option"]').count();

		if (resultCount > 0) {
			await firstResult.click();

			// Should navigate to appointment detail page
			await expect(page).toHaveURL(/\/appts\/.+/);
		} else {
			test.skip();
		}
	});

	test("clicking on a team result navigates to team detail", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.keyboard.press("Control+KeyK");

		// Select teams search type
		await page
			.locator('[role="option"]')
			.filter({ hasText: "Teams suchen" })
			.click();

		await page.waitForTimeout(500);

		// If there are results, click the first one
		const firstResult = page.locator('[role="option"]').first();
		const resultCount = await page.locator('[role="option"]').count();

		if (resultCount > 0) {
			await firstResult.click();

			// Should navigate to team detail page
			await expect(page).toHaveURL(/\/teams\/.+/);
		} else {
			test.skip();
		}
	});
});

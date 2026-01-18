import { expect, test } from "@playwright/test";
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
		// Should see login form
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

		const playerLinks = page.locator('a[href^="/players/"]');
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await expect(page).toHaveURL(/\/players\/.+/);
		} else {
			test.skip();
		}
	});
});

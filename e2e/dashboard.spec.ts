import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Dashboard Route - All Roles", () => {
	test("ADMIN can access dashboard", async ({ page }) => {
		await loginAs(page, "admin");
		// Should be authenticated - check for nav element
		await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access dashboard", async ({ page }) => {
		await loginAs(page, "editor");
		await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access dashboard", async ({ page }) => {
		await loginAs(page, "user");
		await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users see login form", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
		await expect(page.locator('input[name="password"]')).toBeVisible();
	});
});

import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Logout Route - All Roles", () => {
	test("ADMIN can logout", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/logout");
		await page.waitForURL(
			(url) => url.pathname === "/" || url.pathname === "/login",
		);
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});

	test("EDITOR can logout", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/logout");
		await page.waitForURL(
			(url) => url.pathname === "/" || url.pathname === "/login",
		);
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});

	test("USER can logout", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/logout");
		await page.waitForURL(
			(url) => url.pathname === "/" || url.pathname === "/login",
		);
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Password Reset Route - Public Access", () => {
	test("unauthenticated users can access password reset page", async ({
		page,
		context,
	}) => {
		await context.clearCookies();
		await page.goto("/password-reset/test-token");
		await page.waitForLoadState("networkidle");
		// Page should load without error
		await expect(page.locator("body")).toBeVisible();
	});
});

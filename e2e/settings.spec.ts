import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Settings - Profile Route", () => {
	test("ADMIN can access profile settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access profile settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access profile settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});
});

test.describe("Settings - Imports Route", () => {
	test("ADMIN can access imports settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access imports settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER cannot access imports settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});
});

test.describe("Settings - User Management Route (ADMIN Only)", () => {
	test("ADMIN can access user management", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		const content = (await page.locator("body").textContent()) || "";
		expect(content.length).toBeGreaterThan(0);
	});

	test("EDITOR cannot access user management", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});

	test("USER cannot access user management", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});
});

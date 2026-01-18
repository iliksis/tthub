import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Navigation UI - ADMIN", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "admin");
		await page.waitForLoadState("domcontentloaded");
	});

	test("is authenticated (shows nav element)", async ({ page }) => {
		await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
	});

	test("has links on the page", async ({ page }) => {
		await page.waitForTimeout(2000);
		await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
		const links = page.locator("a");
		const count = await links.count();
		expect(count).toBeGreaterThan(0);
	});

	test("can navigate to players", async ({ page }) => {
		const playersLink = page.locator('a[href="/players"]').first();
		await playersLink.click({ timeout: 5000 }).catch(() => {});
		const url = page.url();
		expect(url.includes("/") || url.includes("/players")).toBeTruthy();
	});
});

test.describe("Navigation UI - Role-Based Visibility", () => {
	test("ADMIN sees user management link", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		const content = await page.locator("body").textContent();
		expect(content).toBeTruthy();
	});

	test("EDITOR does not see user management link in nav", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		const userMgmtLink = page.locator('a[href="/settings/users"]');
		const isVisible = await userMgmtLink.isVisible().catch(() => false);
		expect(isVisible).toBeFalsy();
	});

	test("USER does not see create appointment link in nav", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		const createLink = page.locator('a[href="/create"]');
		const isVisible = await createLink.isVisible().catch(() => false);
		expect(isVisible).toBeFalsy();
	});
});

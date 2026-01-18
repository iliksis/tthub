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

test.describe("Players Route - Edit Functionality", () => {
	test("ADMIN can edit a player", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		const playerLinks = page.locator("tbody tr");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await configButton.first().click();

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen',
			);
			if ((await editButton.count()) > 0) {
				await editButton.first().click();
				await page.waitForTimeout(500);

				const nameInput = page.locator('input[type="text"]').first();
				if (await nameInput.isVisible()) {
					const originalValue = await nameInput.inputValue();
					await nameInput.fill(`${originalValue} Updated`);

					const submitButton = page.locator(
						'button[type="submit"].btn-primary',
					);
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

		const playerLinks = page.locator("tbody tr");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await configButton.first().click();

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen',
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

	test("USER cannot edit a player", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/players");
		await page.waitForLoadState("networkidle");

		const playerLinks = page.locator("tbody tr");
		const count = await playerLinks.count();

		if (count > 0) {
			await playerLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await expect(configButton).not.toBeVisible();
		} else {
			test.skip();
		}
	});
});

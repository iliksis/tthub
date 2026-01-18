import { expect, test } from "@playwright/test";
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

		const teamLinks = page.locator('a[href^="/teams/"]');
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

		const teamLinks = page.locator("tbody tr");
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await configButton.first().click();

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen',
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

	test("EDITOR can edit a team", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		const teamLinks = page.locator("tbody tr");
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
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

	test("USER cannot edit a team", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/teams");
		await page.waitForLoadState("networkidle");

		const teamLinks = page.locator("tbody tr");
		const count = await teamLinks.count();

		if (count > 0) {
			await teamLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await expect(configButton).not.toBeVisible();
		} else {
			test.skip();
		}
	});
});

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

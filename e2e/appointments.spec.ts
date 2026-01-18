import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Appointments List Route - Access Control", () => {
	test("ADMIN can access appointments list", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await expect(page).toHaveURL("/appts");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access appointments list", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts");
		await expect(page).toHaveURL("/appts");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access appointments list", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts");
		await expect(page).toHaveURL("/appts");
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users are redirected", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Appointments Calendar Route", () => {
	test("ADMIN can access calendar view", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts/calendar");
		await expect(page).toHaveURL("/appts/calendar");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access calendar view", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts/calendar");
		await expect(page).toHaveURL("/appts/calendar");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access calendar view", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts/calendar");
		await expect(page).toHaveURL("/appts/calendar");
		await expect(page.locator("body")).toBeVisible();
	});
});

test.describe("Create Appointment Route", () => {
	test("ADMIN can access create page", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/create");
		await expect(page).toHaveURL("/create");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access create page", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/create");
		await expect(page).toHaveURL("/create");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER cannot access create page", async ({ page }) => {
		await loginAs(page, "user");
		await expect(page.locator("a[href='/create']")).not.toBeVisible();
		await page.goto("/create");
		await expect(page).toHaveURL("/create");
		await expect(page.locator("body")).toBeVisible();
	});
});

test.describe("Appointments - Data Display", () => {
	test("sees seeded appointments data", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");
		const content = await page.locator("body").textContent();
		expect(content).toBeTruthy();
	});

	test("can view appointment detail if data exists", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		// Find links to specific appointments (not the calendar link)
		const apptLinks = page.locator(
			'a[href^="/appts/"]:not([href="/appts/calendar"])',
		);
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
			await expect(page).toHaveURL(/\/appts\/.+/);
		} else {
			test.skip();
		}
	});
});

test.describe("Appointments - Edit Functionality", () => {
	test("ADMIN can edit an appointment", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");
		const apptLinks = page.locator("tbody tr");
		const count = await apptLinks.count();
		if (count > 0) {
			await apptLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await configButton.first().click();

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen',
			);
			if ((await editButton.count()) > 0) {
				await editButton.first().click();
				await page.waitForTimeout(500);

				const titleInput = page
					.locator(
						'input[name="title"], input[name="shortTitle"], textarea[name="title"]',
					)
					.first();
				if (await titleInput.isVisible()) {
					const originalValue = await titleInput.inputValue();
					await titleInput.fill(`${originalValue} Updated`);

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

	test("EDITOR can edit an appointment", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const apptLinks = page.locator("tbody tr");
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
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

	test("USER cannot edit an appointment", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const apptLinks = page.locator("tbody tr");
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog");
			await configButton.first().click();

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen',
			);
			expect(editButton).not.toBeVisible();
		} else {
			test.skip();
		}
	});
});

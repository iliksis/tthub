import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Settings - Calendar Feed Route", () => {
	test("ADMIN can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("h2:has-text('Kalender-Feed')")).toBeVisible();
	});

	test("EDITOR can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("h2:has-text('Kalender-Feed')")).toBeVisible();
	});

	test("USER can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("h2:has-text('Kalender-Feed')")).toBeVisible();
	});
});

test.describe("Calendar Feed - URL Display", () => {
	test("displays feed URL for logged in user", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("domcontentloaded");

		// Check that the feed URL is displayed
		const feedUrlInput = page.locator('input[type="text"][readonly]').first();
		await expect(feedUrlInput).toBeVisible();

		const feedUrl = await feedUrlInput.inputValue();
		expect(feedUrl).toMatch(/\/feed\/[a-f0-9-]{36}/);
	});
});

test.describe("Calendar Feed - Configuration Options", () => {
	test("displays all response type checkboxes", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("domcontentloaded");

		// Check for Response Types section
		await expect(page.locator("text=Antworttypen")).toBeVisible();
		await expect(page.locator("text=Angenommen")).toBeVisible();
		await expect(page.locator("text=Vielleicht")).toBeVisible();
		await expect(page.locator("text=Abgelehnt")).toBeVisible();
	});

	test("displays all appointment type checkboxes", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("domcontentloaded");

		// Check for Appointment Types section
		await expect(page.locator("text=Terminarten")).toBeVisible();
		await expect(page.locator("text=Turnier").first()).toBeVisible();
		await expect(page.locator("text=Turnier (Deutschland)")).toBeVisible();
		await expect(page.locator("text=Ferien")).toBeVisible();
	});

	test("displays draft status checkbox", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("domcontentloaded");

		// Check for draft appointments checkbox
		await expect(
			page.locator("text=Entwurfs-Termine hinzufügen"),
		).toBeVisible();
	});
});

test.describe("Calendar Feed - API Endpoint", () => {
	test("feed endpoint returns iCal format", async ({ page, request }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("domcontentloaded");

		// Get the feed URL
		const feedUrlInput = page.locator('input[type="text"][readonly]').first();
		const feedUrl = await feedUrlInput.inputValue();

		// Extract just the path
		const url = new URL(feedUrl);
		const feedPath = url.pathname;

		// Make a request to the feed endpoint
		const response = await request.get(feedPath);

		// Check response
		expect(response.status()).toBe(200);
		expect(response.headers()["content-type"]).toContain("text/calendar");

		// Check for iCal format in body
		const body = await response.text();
		expect(body).toContain("BEGIN:VCALENDAR");
		expect(body).toContain("END:VCALENDAR");
		expect(body).toContain("VERSION:2.0");
	});

	test("feed endpoint with invalid feedId returns 404", async ({ request }) => {
		const invalidFeedId = "00000000-0000-0000-0000-000000000000";
		const response = await request.get(`/feed/${invalidFeedId}`);
		expect(response.status()).toBe(404);
	});
});

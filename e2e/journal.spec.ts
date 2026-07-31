import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Transaction Journal Route - Access Control", () => {
	test("ADMIN can access the journal", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await expect(page).toHaveURL("/appts/journal");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access the journal", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts/journal");
		await expect(page).toHaveURL("/appts/journal");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access the journal", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts/journal");
		await expect(page).toHaveURL("/appts/journal");
		await expect(page.locator("body")).toBeVisible();
	});

	test("unauthenticated users are redirected", async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Transaction Journal Route - Data Display", () => {
	test("shows the journal heading and filter controls", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");

		await expect(
			page.getByRole("heading", { name: "Transaktionsjournal" }),
		).toBeVisible();
		await expect(
			page.getByPlaceholder("Termin oder Person suchen…"),
		).toBeVisible();
	});

	test("searching narrows the results to zero without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");

		const summary = page.getByText(/\d+ von \d+ Ereignissen/);
		await expect(summary).toBeVisible();
		const initialText = await summary.textContent();
		const total = initialText?.match(/von (\d+) Ereignissen/)?.[1];

		await page
			.getByPlaceholder("Termin oder Person suchen…")
			.fill("zzz-does-not-exist-zzz");

		await expect(page.getByText(`0 von ${total} Ereignissen`)).toBeVisible();
	});
});

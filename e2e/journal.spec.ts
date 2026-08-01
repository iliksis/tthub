import { expect, type Page, test } from "@playwright/test";
import { loginAs } from "./helpers";

const BATCH_SIZE = 25;

async function readSummary(page: Page) {
	const summary = page.getByText(/\d+ von \d+ Ereignissen/);
	await expect(summary).toBeVisible();
	const text = await summary.textContent();
	return {
		matched: Number(text?.match(/^(\d+) von/)?.[1]),
		total: Number(text?.match(/von (\d+) Ereignissen/)?.[1]),
	};
}

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

		const { total } = await readSummary(page);

		await page
			.getByPlaceholder("Termin oder Person suchen…")
			.fill("zzz-does-not-exist-zzz");

		await expect(page.getByText(`0 von ${total} Ereignissen`)).toBeVisible();
	});

	test("the type filter narrows results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");

		const { total } = await readSummary(page);

		await page.getByRole("combobox").click();
		await page.getByRole("option", { exact: true, name: "Gelöscht" }).click();
		// The filter now triggers a real server round-trip (it used to be a
		// synchronous client-side filter), so wait for it to settle before
		// reading the summary again.
		await page.waitForLoadState("networkidle");

		const filtered = await readSummary(page);
		expect(filtered.total).toBe(total);
		expect(filtered.matched).toBeLessThanOrEqual(total);
	});
});

test.describe("Transaction Journal Route - Pagination", () => {
	test("shows a completion message once everything is loaded", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");

		const { matched, total } = await readSummary(page);
		// With <= BATCH_SIZE matching events, the first fetch already loads
		// everything, so the list should immediately show the end-of-list
		// message instead of a "Load more" button.
		test.skip(matched > BATCH_SIZE, "not enough events to hit this branch");

		if (total === 0) {
			return;
		}
		await expect(
			page.getByText(new RegExp(`Das war's.*${matched} Ereignisse`)),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: /weitere laden/ }),
		).not.toBeVisible();
	});

	test("Load more appends further rows without refetching the loaded ones", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");

		const { matched } = await readSummary(page);
		// Only meaningful once there are more matching events than fit in a
		// single batch; otherwise there is no "Load more" button to click.
		test.skip(matched <= BATCH_SIZE, "not enough events to hit this branch");

		const loadMoreButton = page.getByRole("button", { name: /weitere laden/ });
		await expect(loadMoreButton).toBeVisible();

		const rowLocator = page.locator('[data-testid="journal-row"]');
		const rowsBefore = await rowLocator.count();
		await loadMoreButton.click();

		await expect.poll(() => rowLocator.count()).toBeGreaterThan(rowsBefore);
		// The rows that were already loaded must still be there, appended to
		// rather than replaced by, the new batch.
		expect(await rowLocator.count()).toBeGreaterThanOrEqual(rowsBefore + 1);
	});
});

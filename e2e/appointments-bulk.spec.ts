import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { loginAs } from "./helpers";

const BULK_QUERY = "E2EBULK-";

// Seeds `count` HOLIDAY appointments distinguishable via BULK_QUERY, wiping
// any leftovers from a previous run first — see e2e/seed-bulk-appointments.ts.
// Used by the "select all matching filters" tests below, which need more
// matching rows than fit in one loaded page (BATCH_SIZE in bulk.tsx).
// Playwright runs test files from the repo root, so a plain relative path
// (rather than __dirname, unavailable under Playwright's ESM test runner)
// resolves correctly.
function seedBulkAppointments(count: number) {
	execSync(`npx tsx e2e/seed-bulk-appointments.ts ${count}`, {
		env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
		stdio: "inherit",
	});
}

async function readSummary(page: Page) {
	const summary = page.getByText(/\d+ von \d+ Ereignissen/);
	await expect(summary).toBeVisible();
	const text = await summary.textContent();
	return {
		matched: Number(text?.match(/^(\d+) von/)?.[1]),
		total: Number(text?.match(/von (\d+) Ereignissen/)?.[1]),
	};
}

test.describe("Bulk Appointments Route - Access Control", () => {
	test("ADMIN can access the bulk management page", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await expect(page).toHaveURL("/appts/bulk");
		await expect(
			page.getByRole("heading", { name: "Terminverwaltung" }),
		).toBeVisible();
	});

	test("EDITOR can access the bulk management page", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts/bulk");
		await expect(page).toHaveURL("/appts/bulk");
		await expect(
			page.getByRole("heading", { name: "Terminverwaltung" }),
		).toBeVisible();
	});

	test("USER cannot access the bulk management page", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts/bulk");
		await expect(page).toHaveURL("/appts/bulk");
		await expect(
			page.getByText("Du hast keine Berechtigung, um Termine zu verwalten"),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Terminverwaltung" }),
		).not.toBeVisible();
	});

	test("unauthenticated users are redirected to login", async ({
		page,
		context,
	}) => {
		await context.clearCookies();
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Bulk Appointments Route - Data Display", () => {
	test("shows every appointment type and both past and future dates, excluding deleted ones", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		const { matched, total } = await readSummary(page);
		expect(total).toBeGreaterThanOrEqual(3);
		expect(matched).toBe(total);
	});

	test("searching narrows the results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		const { total } = await readSummary(page);

		await page
			.getByPlaceholder("Termin suchen…")
			.fill("zzz-does-not-exist-zzz");

		await expect(page.getByText(`0 von ${total} Ereignissen`)).toBeVisible();
	});

	test("the season filter narrows results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		const { total } = await readSummary(page);
		const seasonSegment = page.getByRole("button", { name: /^Saison/ });
		if (!(await seasonSegment.isVisible())) {
			test.skip(true, "no season filter available (no seasons seeded)");
		}

		await seasonSegment.click();
		const options = page.getByRole("menuitemradio");
		await options.first().click();
		await page.waitForLoadState("networkidle");

		const filtered = await readSummary(page);
		expect(filtered.total).toBe(total);
		expect(filtered.matched).toBeLessThanOrEqual(total);
	});
});

test.describe("Bulk Appointments Route - Delete", () => {
	test("selecting rows enables Delete selected, which soft-deletes them and logs a journal entry", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		const deleteButton = page.getByRole("button", {
			name: "Ausgewählte löschen",
		});
		await expect(deleteButton).toBeDisabled();

		const rows = page.locator("table tbody tr");
		const rowsBefore = await rows.count();
		test.skip(rowsBefore === 0, "no appointments to delete");

		const firstRowTitle = await rows.first().locator("a").first().textContent();
		await rows.first().getByRole("checkbox").click();

		await expect(deleteButton).toBeEnabled();
		await deleteButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.getByRole("button", { name: "Löschen" }).click();

		await expect(page.getByText(/gelöscht/)).toBeVisible();
		await expect.poll(() => rows.count()).toBe(rowsBefore - 1);

		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");
		if (firstRowTitle) {
			await expect(
				page.getByText(new RegExp(firstRowTitle.trim())).first(),
			).toBeVisible();
		}
	});

	// bulkDeleteAppointments is gated the same way as deleteAppointment
	// (requireEditor) — since USER can't reach /appts/bulk at all (see the
	// Access Control block above), there's no UI path for a USER to invoke it.
});

test.describe("Bulk Appointments Route - Select All Matching Filters", () => {
	test.beforeEach(() => {
		seedBulkAppointments(30);
	});

	test.afterAll(() => {
		seedBulkAppointments(0);
	});

	test("select all matching filters selects beyond the loaded batch", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		await page.getByPlaceholder("Termin suchen…").fill(BULK_QUERY);
		await expect(page.getByText(/30 von \d+ Ereignissen/)).toBeVisible();

		const rows = page.locator("table tbody tr");
		// Only one loaded batch (25) is rendered even though 30 rows match.
		await expect(rows).toHaveCount(25);

		await page
			.getByRole("button", { name: "30 passende Termine auswählen" })
			.click();

		const deleteButton = page.getByRole("button", {
			name: "Ausgewählte löschen",
		});
		await expect(deleteButton).toBeEnabled();
		await deleteButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await expect(
			confirmDialog.getByText(
				"Bist du sicher, dass du 30 Termine löschen möchtest?",
			),
		).toBeVisible();
		await confirmDialog.getByRole("button", { name: "Löschen" }).click();

		await expect(page.getByText(/gelöscht/)).toBeVisible();
		// All 30 are gone, including the 5 that were never loaded into the page.
		await expect(page.getByText(/^0 von \d+ Ereignissen/)).toBeVisible();
	});

	test("deselecting one row after select-all preserves the rest", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		await page.getByPlaceholder("Termin suchen…").fill(BULK_QUERY);
		await expect(page.getByText(/30 von \d+ Ereignissen/)).toBeVisible();

		await page
			.getByRole("button", { name: "30 passende Termine auswählen" })
			.click();

		const rows = page.locator("table tbody tr");
		const firstRowTitle = await rows.first().locator("a").first().textContent();
		await rows.first().getByRole("checkbox").click();

		await expect(page.getByText("29 passend, 1 ausgeschlossen")).toBeVisible();

		const deleteButton = page.getByRole("button", {
			name: "Ausgewählte löschen",
		});
		await deleteButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(
			confirmDialog.getByText(
				"Bist du sicher, dass du 29 Termine löschen möchtest?",
			),
		).toBeVisible();
		await confirmDialog.getByRole("button", { name: "Löschen" }).click();

		await expect(page.getByText(/gelöscht/)).toBeVisible();
		// The excluded row survives; the other 29 matching rows are gone.
		await expect(page.getByText(/^1 von \d+ Ereignissen/)).toBeVisible();
		if (firstRowTitle) {
			await expect(page.getByText(firstRowTitle.trim())).toBeVisible();
		}
	});
});

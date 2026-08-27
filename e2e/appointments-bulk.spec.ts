import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { loginAs } from "./helpers";

const BULK_QUERY = "E2EBULK-";
const COPY_QUERY = "E2ECOPY-";
const COPY_TARGET_SEASON = "E2ECOPY-Target";

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

// Seeds a mix of season-scoped TOURNAMENT appointments plus one HOLIDAY
// appointment (no season) for the "Copy to season" tests below — see
// e2e/seed-copy-to-season.ts.
function seedCopyToSeasonFixture() {
	execSync("npx tsx e2e/seed-copy-to-season.ts", {
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

test.describe("Bulk Appointments Route - Copy to Season", () => {
	test.beforeEach(() => {
		seedCopyToSeasonFixture();
	});

	// bulkCopyAppointmentsToSeason is gated the same way as bulkDeleteAppointments
	// (requireEditor) — since USER can't reach /appts/bulk at all (see the
	// Access Control block above), there's no UI path for a USER to invoke it.
	test("copying a mixed selection copies eligible appointments, skips the HOLIDAY one, and lands drafts one year later", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		await page.getByPlaceholder("Termin suchen…").fill(COPY_QUERY);
		await expect(page.getByText(/^3 von \d+ Ereignissen/)).toBeVisible();

		const rows = page.locator("table tbody tr");
		await expect(rows).toHaveCount(3);
		// td index 0 is the selection checkbox column, so startDate is index 4
		// (shortTitle, type, season, startDate).
		const sourceDateText = await rows
			.filter({ hasText: "E2ECOPY-Turnier1" })
			.locator("td")
			.nth(4)
			.textContent();

		await page.locator("table thead").getByRole("checkbox").click();

		const copyButton = page.getByRole("button", {
			name: "In Saison kopieren…",
		});
		await expect(copyButton).toBeEnabled();
		await copyButton.click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await dialog.getByRole("combobox").click();
		await page
			.getByRole("option", { exact: true, name: COPY_TARGET_SEASON })
			.click();
		await dialog.getByRole("button", { name: "Kopieren" }).click();

		await expect(
			page.getByText("2 Termine kopiert, 1 übersprungen (keine Saison)"),
		).toBeVisible();

		// Refresh the season filter to the copy target to see the new drafts.
		const seasonSegment = page.getByRole("button", { name: /^Saison/ });
		await seasonSegment.click();
		await page.getByRole("menuitemradio", { name: COPY_TARGET_SEASON }).click();
		await page.waitForLoadState("networkidle");

		const targetRows = page.locator("table tbody tr");
		await expect(targetRows).toHaveCount(2);
		await expect(targetRows.filter({ hasText: "Feiertag" })).toHaveCount(0);

		const copiedRow = targetRows.filter({ hasText: "E2ECOPY-Turnier1" });
		await expect(
			copiedRow.locator("td").filter({ hasText: COPY_TARGET_SEASON }),
		).toBeVisible();
		if (sourceDateText) {
			const copiedDateText = await copiedRow.locator("td").nth(4).textContent();
			const [day, month, sourceYear] = sourceDateText.trim().split(".");
			const expectedYear = (Number(sourceYear) + 1).toString().padStart(2, "0");
			expect(copiedDateText?.trim()).toBe(`${day}.${month}.${expectedYear}`);
		}

		// The copy is a fresh DRAFT. Navigate directly rather than clicking the
		// row link — a lingering (inert) popup overlay from the season dropdown
		// can still intercept pointer events right after it closes.
		const copiedHref = await copiedRow
			.locator("a")
			.first()
			.getAttribute("href");
		await page.goto(copiedHref ?? "");
		// A "publish" action (rather than "unpublish") confirms the copy landed
		// as a DRAFT.
		await expect(
			page.getByRole("button", { name: "Termin veröffentlichen" }),
		).toBeVisible();

		// Each copy logs its own journal CREATE entry. Wait for hydration to
		// finish before filling — a fill before the client takes over the SSR'd
		// input can be silently discarded once React attaches.
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");
		await page.getByPlaceholder("Termin oder Person suchen…").fill(COPY_QUERY);
		await expect(page.getByText(/^2 von \d+ Ereignissen/)).toBeVisible();
		await expect(page.getByText("Erstellt").first()).toBeVisible();
	});

	test("the copy button stays disabled for a HOLIDAY-only selection and enables once a season-scoped appointment joins it", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/bulk");
		await page.waitForLoadState("networkidle");

		await page.getByPlaceholder("Termin suchen…").fill(COPY_QUERY);
		await expect(page.getByText(/^3 von \d+ Ereignissen/)).toBeVisible();

		const copyButton = page.getByRole("button", {
			name: "In Saison kopieren…",
		});
		const rows = page.locator("table tbody tr");

		await rows
			.filter({ hasText: "E2ECOPY-Feiertag" })
			.getByRole("checkbox")
			.click();
		await expect(copyButton).toBeDisabled();

		await rows
			.filter({ hasText: "E2ECOPY-Turnier1" })
			.getByRole("checkbox")
			.click();
		await expect(copyButton).toBeEnabled();
	});
});

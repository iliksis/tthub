import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { loginAs, readRowTitle, readSummary } from "./helpers";

const TRASH_QUERY = "E2ETRASH-";
const DATA_DISPLAY_QUERY = "E2ETRASHDD-";

// Seeds `count` soft-deleted HOLIDAY appointments distinguishable via
// TRASH_QUERY, wiping any leftovers from a previous run first — see
// e2e/seed-trash-appointments.ts. Used by the "select all matching filters"
// tests below, which need more matching rows than fit in one loaded page
// (BATCH_SIZE in trash.tsx). Playwright runs test files from the repo root,
// so a plain relative path (rather than __dirname, unavailable under
// Playwright's ESM test runner) resolves correctly.
function seedTrashAppointments(count: number) {
	execSync(`npx tsx e2e/seed-trash-appointments.ts ${count}`, {
		env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
		stdio: "inherit",
	});
}

// Seeds a small mix of soft-deleted appointment types (HOLIDAY x2, a
// season-scoped TOURNAMENT) for the Data Display and Restore blocks below —
// see e2e/seed-trash-data-display.ts.
function seedTrashDataDisplay() {
	execSync("npx tsx e2e/seed-trash-data-display.ts", {
		env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
		stdio: "inherit",
	});
}

function cleanupTrashDataDisplay() {
	execSync("npx tsx e2e/seed-trash-data-display.ts --cleanup-only", {
		env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
		stdio: "inherit",
	});
}

// The desktop FilterBar and AppointmentMobileFilters both render a "Termin
// suchen…" input (one hidden via `lg:hidden`/`hidden lg:block`, not removed
// from the DOM), so a plain getByPlaceholder resolves to two elements even
// on a desktop viewport. Scope to the visible one, matching the `:visible`
// pattern already used elsewhere in this suite for the same desktop/mobile
// duplication (e.g. e2e/players.spec.ts, e2e/teams.spec.ts).
function searchInput(page: Page) {
	return page.locator('input[placeholder="Termin suchen…"]:visible');
}

test.describe("Trash Route - Access Control", () => {
	test("ADMIN can access the trash page", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await expect(page).toHaveURL("/appts/trash");
		await expect(
			page.getByRole("heading", { name: "Papierkorb" }),
		).toBeVisible();
	});

	test("EDITOR can access the trash page", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts/trash");
		await expect(page).toHaveURL("/appts/trash");
		await expect(
			page.getByRole("heading", { name: "Papierkorb" }),
		).toBeVisible();
	});

	test("USER cannot access the trash page", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts/trash");
		await expect(page).toHaveURL("/appts/trash");
		await expect(
			page.getByText("Du hast keine Berechtigung, um Termine zu verwalten"),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Papierkorb" }),
		).not.toBeVisible();
	});

	test("unauthenticated users are redirected to login", async ({
		page,
		context,
	}) => {
		await context.clearCookies();
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");
		await expect(page.locator('input[name="userName"]')).toBeVisible();
	});
});

test.describe("Trash Route - Data Display", () => {
	test.beforeEach(() => {
		seedTrashDataDisplay();
	});

	test("only shows soft-deleted appointments, and searching narrows the results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(DATA_DISPLAY_QUERY);
		const { total } = await readSummary(page);
		await expect(page.getByText(`3 von ${total} Ereignissen`)).toBeVisible();

		await searchInput(page).fill("zzz-does-not-exist-zzz");
		await expect(page.getByText(`0 von ${total} Ereignissen`)).toBeVisible();
	});

	test("the season filter narrows results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(DATA_DISPLAY_QUERY);
		const { total } = await readSummary(page);

		const seasonSegment = page.getByRole("button", { name: /^Saison/ });
		await seasonSegment.click();
		const options = page.getByRole("menuitemradio");
		await options.first().click();
		await page.waitForLoadState("networkidle");

		const filtered = await readSummary(page);
		expect(filtered.total).toBe(total);
		expect(filtered.matched).toBeLessThanOrEqual(total);
	});

	test("the type filter narrows results without changing the total", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(DATA_DISPLAY_QUERY);
		const { total } = await readSummary(page);
		const loadingOverlay = page.locator(".pointer-events-none.opacity-60");

		await page.getByRole("button", { name: /^Typ/ }).click();
		await page.getByRole("menuitemcheckbox", { name: "Ferien" }).click();
		await page.keyboard.press("Escape");
		await expect(loadingOverlay).toHaveCount(0);

		const holidayOnly = await readSummary(page);
		expect(holidayOnly.total).toBe(total);
		expect(holidayOnly.matched).toBeLessThanOrEqual(total);
	});

	test("no permanent-delete control exists anywhere on the page", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(DATA_DISPLAY_QUERY);
		await page.locator("table thead").getByRole("checkbox").click();

		await expect(
			page.getByRole("button", { name: "Wiederherstellen" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: /löschen/i }),
		).not.toBeVisible();
	});
});

test.describe("Trash Route - Restore", () => {
	test.beforeEach(() => {
		seedTrashDataDisplay();
	});

	// Last describe block that needs this fixture — clean it up once these
	// tests finish, matching the "Select All Matching Filters" blocks below.
	test.afterAll(() => {
		cleanupTrashDataDisplay();
	});

	test("selecting rows enables Restore selected, which clears deletedAt and logs a RESTORE journal entry", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(DATA_DISPLAY_QUERY);
		await expect(page.getByText(/^3 von \d+ Ereignissen/)).toBeVisible();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen",
		});
		await expect(restoreButton).toBeDisabled();

		const rows = page.locator("table tbody tr");
		const rowsBefore = await rows.count();
		const firstRowTitle = await readRowTitle(rows.first());
		await rows.first().getByRole("checkbox").click();

		await expect(restoreButton).toBeEnabled();
		await restoreButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog
			.getByRole("button", { name: "Wiederherstellen" })
			.click();

		await expect(page.getByText(/wiederhergestellt/)).toBeVisible();
		await expect.poll(() => rows.count()).toBe(rowsBefore - 1);

		expect(firstRowTitle).toBeTruthy();
		await page.goto("/appts/journal");
		await page.waitForLoadState("networkidle");
		await page
			.getByPlaceholder("Termin oder Person suchen…")
			.fill(firstRowTitle?.trim() ?? "");
		await page.getByRole("combobox").click();
		await page
			.getByRole("option", { exact: true, name: "Wiederhergestellt" })
			.click();
		await page.waitForLoadState("networkidle");

		const journalRows = page.getByTestId("journal-row");
		await expect(journalRows).toHaveCount(1);
		await expect(journalRows.first()).toContainText(
			firstRowTitle?.trim() ?? "",
		);
	});

	// bulkRestoreAppointments is gated the same way as restoreAppointment
	// (requireEditor) — since USER can't reach /appts/trash at all (see the
	// Access Control block above), there's no UI path for a USER to invoke it.
});

test.describe("Trash Route - Select All Matching Filters", () => {
	test.beforeEach(() => {
		seedTrashAppointments(30);
	});

	test.afterAll(() => {
		seedTrashAppointments(0);
	});

	test("select all matching filters selects beyond the loaded batch", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(TRASH_QUERY);
		await expect(page.getByText(/30 von \d+ Ereignissen/)).toBeVisible();
		// The search input is debounced (300ms) before it navigates/re-filters;
		// entering select-all-matching before that commit lands would have its
		// state wiped by useBulkSelection's filterKey-change reset once the
		// debounced navigation finally lands. A plain waitForLoadState right
		// after fill() isn't enough on its own — the debounce's setTimeout may
		// not have fired yet, so the page can already look network-idle before
		// the debounced request even starts; wait out the debounce window
		// first, then for that request to actually finish.
		await page.waitForTimeout(350);
		await page.waitForLoadState("networkidle");

		const rows = page.locator("table tbody tr");
		// Only one loaded batch (25) is rendered even though 30 rows match.
		await expect(rows).toHaveCount(25);

		await page
			.getByRole("button", { name: "30 passende Termine auswählen" })
			.click();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen",
		});
		await expect(restoreButton).toBeEnabled();
		await restoreButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await expect(
			confirmDialog.getByText(
				"Bist du sicher, dass du 30 Termine wiederherstellen möchtest?",
			),
		).toBeVisible();
		await confirmDialog
			.getByRole("button", { name: "Wiederherstellen" })
			.click();

		await expect(page.getByText(/wiederhergestellt/)).toBeVisible();
		// All 30 are gone, including the 5 that were never loaded into the page.
		await expect(page.getByText(/^0 von \d+ Ereignissen/)).toBeVisible();
	});

	test("deselecting one row after select-all preserves the rest", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(TRASH_QUERY);
		await expect(page.getByText(/30 von \d+ Ereignissen/)).toBeVisible();
		// See the comment in the previous test — wait for the debounced search
		// navigation to settle before entering select-all-matching, or its state
		// gets wiped once that navigation lands.
		await page.waitForTimeout(350);
		await page.waitForLoadState("networkidle");

		await page
			.getByRole("button", { name: "30 passende Termine auswählen" })
			.click();

		const rows = page.locator("table tbody tr");
		const firstRowTitle = await readRowTitle(rows.first());
		await rows.first().getByRole("checkbox").click();

		await expect(page.getByText("29 passend, 1 ausgeschlossen")).toBeVisible();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen",
		});
		await restoreButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(
			confirmDialog.getByText(
				"Bist du sicher, dass du 29 Termine wiederherstellen möchtest?",
			),
		).toBeVisible();
		await confirmDialog
			.getByRole("button", { name: "Wiederherstellen" })
			.click();

		await expect(page.getByText(/wiederhergestellt/)).toBeVisible();
		// The excluded row survives; the other 29 matching rows are gone.
		await expect(page.getByText(/^1 von \d+ Ereignissen/)).toBeVisible();
		if (firstRowTitle) {
			// Scoped to the table rather than page-wide getByText — the mobile
			// card list renders the same title text in the DOM (hidden via
			// `lg:hidden`, not removed), which would otherwise resolve to 2
			// elements on a desktop viewport.
			await expect(rows.filter({ hasText: firstRowTitle.trim() })).toHaveCount(
				1,
			);
		}
	});

	test("no select-all-matching control appears and Restore stays disabled when the filter matches nothing", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill("zzz-does-not-exist-zzz");
		await expect(page.getByText(/^0 von \d+ Ereignissen/)).toBeVisible();

		await expect(
			page.getByRole("button", { name: /passende Termine auswählen/ }),
		).not.toBeVisible();
		await expect(
			page.getByRole("button", { name: "Wiederherstellen" }),
		).toBeDisabled();
	});

	test("excluding every loaded row after select-all leaves Restore disabled again", async ({
		page,
	}) => {
		// Overrides the describe's beforeEach seed (30, more than one batch) with
		// a count that fits in a single loaded page, so the header checkbox can
		// exclude every matching row down to zero.
		seedTrashAppointments(5);
		await loginAs(page, "admin");
		await page.goto("/appts/trash");
		await page.waitForLoadState("networkidle");

		await searchInput(page).fill(TRASH_QUERY);
		await expect(page.getByText(/^5 von \d+ Ereignissen/)).toBeVisible();
		await page.waitForTimeout(350);
		await page.waitForLoadState("networkidle");

		await page
			.getByRole("button", { name: "5 passende Termine auswählen" })
			.click();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen",
		});
		await expect(restoreButton).toBeEnabled();

		await page.locator("table thead").getByRole("checkbox").click();

		await expect(page.getByText("0 passend, 5 ausgeschlossen")).toBeVisible();
		await expect(restoreButton).toBeDisabled();
	});
});

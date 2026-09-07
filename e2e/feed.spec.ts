import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { catppuccinLatteHex } from "../src/lib/labelColor";
import { cleanupByTitlePrefix, loginAs } from "./helpers";

test.describe("Settings - Calendar Feed Route", () => {
	test("ADMIN can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.getByText("Deine Feed-URL")).toBeVisible();
	});

	test("EDITOR can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.getByText("Deine Feed-URL")).toBeVisible();
	});

	test("USER can access calendar feed settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await expect(page).toHaveURL("/settings/feed");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.getByText("Deine Feed-URL")).toBeVisible();
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

test.describe("Calendar Feed - Exclude by Label", () => {
	const LABEL_PREFIX = "E2EFEEDLABEL-";
	const TITLE_PREFIX = "E2EFEED-";

	test.beforeAll(async () => {
		await cleanupByTitlePrefix(TITLE_PREFIX);
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
	});

	test.afterAll(async () => {
		await cleanupByTitlePrefix(TITLE_PREFIX);
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
		// This test saves real feed config for the shared "user" fixture
		// account (enabling TOURNAMENT, adding the exclusion) — reset it so
		// other specs see the same blank-slate FeedConfig they'd otherwise get.
		await prismaClient.feedConfig.deleteMany({
			where: { user: { userName: "user" } },
		});
		await prismaClient.$disconnect();
	});

	test("the label-exclusion picker appears, persists, and the feed omits appointments carrying an excluded label", async ({
		page,
		request,
	}) => {
		const excludedLabelName = `${LABEL_PREFIX}Excluded`;
		const excludedTitle = `${TITLE_PREFIX}Excluded`;
		const includedTitle = `${TITLE_PREFIX}Included`;
		const label = await prismaClient.label.create({
			data: { color: "red", name: excludedLabelName },
		});
		const season = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const startDate = new Date(Date.now() + 86400000);
		const excludedAppointment = await prismaClient.appointment.create({
			data: {
				labels: { create: { labelId: label.id } },
				seasonId: season.id,
				startDate,
				status: "PUBLISHED",
				title: excludedTitle,
				type: "TOURNAMENT",
			},
		});
		const includedAppointment = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate,
				status: "PUBLISHED",
				title: includedTitle,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "user");
		await page.goto("/settings/feed");
		await page.waitForLoadState("networkidle");

		// The feed's own appointment-type filter defaults to "none" until a type
		// is explicitly checked — TOURNAMENT must be on for either fixture
		// appointment to appear in the feed at all. The real checkbox input is
		// visually hidden behind a styled control, so toggle it via its
		// associated <label> instead of clicking the (offscreen) input directly.
		const tournamentCheckbox = page.locator("#type-TOURNAMENT");
		if (!(await tournamentCheckbox.isChecked())) {
			await page.locator('label[for="type-TOURNAMENT"]').click();
		}

		await expect(page.getByText("Nach Label ausschließen")).toBeVisible();
		const labelInput = page.getByPlaceholder("Label suchen…");
		await labelInput.fill(excludedLabelName);
		await page
			.getByRole("button", { exact: true, name: excludedLabelName })
			.click();

		await page.getByRole("button", { name: "Aktualisieren" }).click();
		await expect(
			page.getByText("Feed-Einstellungen aktualisiert"),
		).toBeVisible();

		await page.reload();
		await page.waitForLoadState("networkidle");
		await expect(page.getByText(excludedLabelName)).toBeVisible();
		await expect(page.locator("#type-TOURNAMENT")).toBeChecked();

		const feedUrlInput = page.locator('input[type="text"][readonly]').first();
		const feedUrl = await feedUrlInput.inputValue();
		const feedPath = new URL(feedUrl).pathname;
		const response = await request.get(feedPath);
		const body = await response.text();

		expect(body).not.toContain(excludedTitle);
		expect(body).toContain(includedTitle);

		await prismaClient.appointment.delete({
			where: { id: excludedAppointment.id },
		});
		await prismaClient.appointment.delete({
			where: { id: includedAppointment.id },
		});
	});
});

test.describe("Calendar Feed - Label Color", () => {
	const LABEL_PREFIX = "E2EFEEDCOLOR-";
	const TITLE_PREFIX = "E2EFEEDCOLOR-";

	test.beforeAll(async () => {
		await cleanupByTitlePrefix(TITLE_PREFIX);
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
	});

	test.afterAll(async () => {
		await cleanupByTitlePrefix(TITLE_PREFIX);
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
		await prismaClient.feedConfig.deleteMany({
			where: { user: { userName: "admin" } },
		});
		await prismaClient.$disconnect();
	});

	test("the feed emits COLOR from the highest-priority label, and none for an unlabeled appointment", async ({
		page,
		request,
	}) => {
		const winnerName = `${LABEL_PREFIX}Winner`;
		const loserName = `${LABEL_PREFIX}Loser`;
		const coloredTitle = `${TITLE_PREFIX}Colored`;
		const plainTitle = `${TITLE_PREFIX}Plain`;
		// Priority values far outside the normal 0..n-1 range so this fixture's
		// ordering can't collide with whatever the rest of the catalog holds.
		const winner = await prismaClient.label.create({
			data: { color: "mauve", name: winnerName, priority: -1000 },
		});
		const loser = await prismaClient.label.create({
			data: { color: "peach", name: loserName, priority: 1000 },
		});
		const season = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const startDate = new Date(Date.now() + 86400000);
		const coloredAppointment = await prismaClient.appointment.create({
			data: {
				labels: {
					create: [{ labelId: loser.id }, { labelId: winner.id }],
				},
				seasonId: season.id,
				startDate,
				status: "PUBLISHED",
				title: coloredTitle,
				type: "TOURNAMENT",
			},
		});
		const plainAppointment = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate,
				status: "PUBLISHED",
				title: plainTitle,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "admin");
		await page.goto("/settings/feed");
		await page.waitForLoadState("networkidle");

		const tournamentCheckbox = page.locator("#type-TOURNAMENT");
		if (!(await tournamentCheckbox.isChecked())) {
			await page.locator('label[for="type-TOURNAMENT"]').click();
		}
		await page.getByRole("button", { name: "Aktualisieren" }).click();
		await expect(
			page.getByText("Feed-Einstellungen aktualisiert"),
		).toBeVisible();

		const feedUrlInput = page.locator('input[type="text"][readonly]').first();
		const feedUrl = await feedUrlInput.inputValue();
		const feedPath = new URL(feedUrl).pathname;
		const response = await request.get(feedPath);
		const body = await response.text();

		// Find the VEVENT for the colored appointment and confirm its COLOR
		// line uses the winning (lowest-priority-value) label's color, not the
		// other attached label's — then confirm the unlabeled appointment's
		// VEVENT has no COLOR line at all.
		const events = body.split("BEGIN:VEVENT");
		const coloredEvent = events.find((e) => e.includes(coloredTitle));
		const plainEvent = events.find((e) => e.includes(plainTitle));
		expect(coloredEvent).toContain(`COLOR:${catppuccinLatteHex.mauve}`);
		expect(coloredEvent).not.toContain(catppuccinLatteHex.peach);
		expect(plainEvent).not.toContain("COLOR:");

		await prismaClient.appointment.delete({
			where: { id: coloredAppointment.id },
		});
		await prismaClient.appointment.delete({
			where: { id: plainAppointment.id },
		});
	});
});

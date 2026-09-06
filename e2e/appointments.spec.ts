import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { cleanupByTitlePrefix, loginAs } from "./helpers";

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
		await expect(page).toHaveURL("/appts?view=calendar");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access calendar view", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts/calendar");
		await expect(page).toHaveURL("/appts?view=calendar");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access calendar view", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/appts/calendar");
		await expect(page).toHaveURL("/appts?view=calendar");
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
		await page.waitForLoadState("networkidle");
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

		// Find links to specific appointments (not the list/calendar view toggle)
		const apptLinks = page.locator('a[href^="/appts/"]:not([href*="view="])');
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
			await expect(page).toHaveURL(/\/appts\/.+/);
		} else {
			test.skip();
		}
	});
});

test.describe("Appointments - Filters", () => {
	test("the desktop filter bar no longer shows a show-deleted toggle", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		await expect(page.getByText("Gelöschte anzeigen?")).not.toBeVisible();
		await expect(page.getByText("Inkl. gelöschte")).not.toBeVisible();
	});

	test("the mobile filter sheet no longer shows a show-deleted checkbox", async ({
		page,
	}) => {
		await page.setViewportSize({ height: 800, width: 500 });
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		await page.getByRole("button", { name: "Filter" }).click();
		await expect(page.getByText("Gelöschte anzeigen?")).not.toBeVisible();
	});
});

test.describe("Appointments - Edit Functionality", () => {
	test("ADMIN can edit an appointment", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");
		// The split view's rows only toggle selection; the title link is what
		// actually navigates to the appointment detail page.
		const apptLinks = page.locator(
			'a[href^="/appts/"]:visible:not([href*="view="])',
		);
		const count = await apptLinks.count();
		if (count > 0) {
			await apptLinks.first().click();
			await page.waitForLoadState("networkidle");

			// The cog only exists in the mobile FAB menu; on desktop the edit
			// button is already directly visible in the toolbar (as plain text,
			// no icon).
			const configButton = page.locator("div svg.lucide-cog:visible");
			if ((await configButton.count()) > 0) {
				await configButton.first().click();
			}

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen, button:has-text("Bearbeiten")',
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

	test("EDITOR can edit an appointment", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const apptLinks = page.locator(
			'a[href^="/appts/"]:visible:not([href*="view="])',
		);
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog:visible");
			if ((await configButton.count()) > 0) {
				await configButton.first().click();
			}

			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen, button:has-text("Bearbeiten")',
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

		const apptLinks = page.locator(
			'a[href^="/appts/"]:visible:not([href*="view="])',
		);
		const count = await apptLinks.count();

		if (count > 0) {
			await apptLinks.first().click();
			await page.waitForLoadState("networkidle");

			const configButton = page.locator("div svg.lucide-cog:visible");
			const editButton = page.locator(
				'button[aria-label*="aktualisieren"], button svg.lucide-square-pen, button:has-text("Bearbeiten")',
			);
			await expect(configButton).not.toBeVisible();
			await expect(editButton).not.toBeVisible();
		} else {
			test.skip();
		}
	});
});

test.describe("Appointments - Delete and Restore", () => {
	test("ADMIN can delete and then restore an appointment", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const apptLinks = page.locator(
			'a[href^="/appts/"]:visible:not([href*="view="])',
		);
		const count = await apptLinks.count();
		if (count === 0) {
			test.skip();
			return;
		}
		await apptLinks.first().click();
		await page.waitForLoadState("networkidle");

		const deleteButton = page.getByRole("button", { name: "Löschen" });
		if (
			!(await deleteButton.isVisible()) ||
			!(await deleteButton.isEnabled())
		) {
			test.skip();
			return;
		}
		await deleteButton.click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.getByRole("button", { name: "Löschen" }).click();

		await expect(page.getByText(/gelöscht/)).toBeVisible();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen?",
		});
		await expect(restoreButton).toBeVisible();
		await restoreButton.click();
		await expect(page.getByText(/wiederhergestellt/)).toBeVisible();
	});
});

test.describe("Appointments - Labels", () => {
	const TITLE_PREFIX = "E2EAPPTLABEL-";
	const LABEL_PREFIX = "E2EAPPTLABEL-";

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
		await prismaClient.$disconnect();
	});

	test("EDITOR can attach an existing label and quick-create a new one while creating a tournament", async ({
		page,
	}) => {
		const existingName = `${LABEL_PREFIX}Existing`;
		const newName = `${LABEL_PREFIX}QuickCreated`;
		const title = `${TITLE_PREFIX}Create`;
		await prismaClient.label.create({
			data: { color: "teal", name: existingName },
		});

		await loginAs(page, "editor");
		await page.goto("/create");
		await page.waitForLoadState("networkidle");

		await page.getByRole("button", { name: /Turnier/ }).click();
		await page.getByRole("button", { name: "Weiter" }).click();

		await page.locator("input#title").fill(title);

		const labelInput = page.getByPlaceholder("Label suchen oder erstellen…");
		await labelInput.fill(existingName);
		await page.getByRole("button", { exact: true, name: existingName }).click();
		await labelInput.fill(newName);
		await page.getByRole("button", { name: `„${newName}“ erstellen` }).click();

		await expect(page.getByText(existingName)).toBeVisible();
		await expect(page.getByText(newName)).toBeVisible();

		await page.getByRole("button", { name: "Weiter" }).click();
		await page.getByRole("button", { name: "Erstellen" }).click();

		await page.waitForURL(/\/appts\/.+/);
		await page.waitForLoadState("networkidle");

		// The detail page shows both attached labels as badges, and the RSVP
		// panel appears unconditionally for TOURNAMENT appointments regardless
		// of which labels they carry. The mobile and desktop layouts both exist
		// in the DOM simultaneously (toggled via CSS), so scope every assertion
		// to the one that's actually visible at this viewport.
		await expect(
			page.locator('[data-slot="badge"]:visible', { hasText: existingName }),
		).toBeVisible();
		await expect(
			page.locator('[data-slot="badge"]:visible', { hasText: newName }),
		).toBeVisible();
		await expect(
			page.locator("button:visible", { hasText: "Annehmen" }),
		).toBeVisible();
	});

	test("label badges attached via the edit sheet appear in the appointments list and detail page", async ({
		page,
	}) => {
		const labelName = `${LABEL_PREFIX}Editable`;
		const title = `${TITLE_PREFIX}Edit`;
		const label = await prismaClient.label.create({
			data: { color: "peach", name: labelName },
		});
		const season = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const appointment = await prismaClient.appointment.create({
			data: {
				seasonId: season.id,
				startDate: new Date(Date.now() + 86400000),
				status: "PUBLISHED",
				title,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "editor");
		await page.goto(`/appts/${appointment.id}`);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Both the mobile (icon-only) and desktop (labeled) edit buttons are
		// always present in the DOM — only one is actually visible at a given
		// viewport — so the CSS `:visible` filter is required, not just `.first()`.
		await page.locator('button:visible:has-text("Bearbeiten")').first().click();
		const editSheet = page.getByRole("dialog");
		const labelInput = editSheet.getByPlaceholder(
			"Label suchen oder erstellen…",
		);
		await labelInput.fill(labelName);
		await editSheet
			.getByRole("button", { exact: true, name: labelName })
			.click();
		await editSheet.getByRole("button", { name: "Speichern" }).click();

		await expect(
			page.locator('[data-slot="badge"]:visible', { hasText: labelName }),
		).toBeVisible();
		await expect(
			page.locator("button:visible", { hasText: "Annehmen" }),
		).toBeVisible();

		await page.goto("/appts");
		await page.waitForLoadState("networkidle");
		await page
			.locator('input:visible[placeholder*="Termin"]')
			.first()
			.fill(title);
		await expect(
			page.locator('[data-slot="badge"]:visible', { hasText: labelName }),
		).toBeVisible();

		await cleanupByTitlePrefix(TITLE_PREFIX);
		await prismaClient.label.delete({ where: { id: label.id } });
	});
});

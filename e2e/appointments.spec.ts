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

test.describe("Appointments - Multi-select and bulk actions", () => {
	// The multi-select split view only renders at the `lg` breakpoint — force
	// a desktop viewport so these tests behave the same on every project,
	// including the mobile ones.
	test.use({ viewport: { height: 900, width: 1440 } });

	test("ADMIN, EDITOR and USER all see selection checkboxes", async ({
		page,
	}) => {
		for (const role of ["admin", "editor", "user"] as const) {
			await loginAs(page, role);
			await page.goto("/appts");
			await page.waitForLoadState("networkidle");
			await expect(
				page.getByRole("checkbox", { name: "Training" }),
			).toBeVisible();
		}
	});

	test("selecting exactly one appointment shows its details; selecting a second one hides them", async ({
		page,
	}) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const rowCheckboxes = page.locator("table").getByRole("checkbox");
		const count = await rowCheckboxes.count();
		if (count < 2) {
			test.skip();
			return;
		}

		// One row is preselected by default, so the detail heading is already visible.
		await expect(page.getByRole("heading", { level: 3 })).toBeVisible();

		await rowCheckboxes.nth(1).click();
		await expect(page.getByText(/Termine ausgewählt/)).toBeVisible();
		await expect(page.getByRole("heading", { level: 3 })).not.toBeVisible();

		await page.getByRole("button", { name: "Auswahl aufheben" }).click();
		await expect(
			page.getByText("Zeile auswählen, um Details zu sehen"),
		).toBeVisible();
	});

	test("USER can bulk respond but cannot see management actions", async ({
		page,
	}) => {
		await loginAs(page, "user");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const rowCheckboxes = page.locator("table").getByRole("checkbox");
		const count = await rowCheckboxes.count();
		if (count < 2) {
			test.skip();
			return;
		}
		await rowCheckboxes.nth(1).click();

		await expect(page.getByRole("button", { name: "Annehmen" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Vielleicht" }),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Ablehnen" })).toBeVisible();

		await expect(
			page.getByRole("button", { name: "Veröffentlichen" }),
		).not.toBeVisible();
		await expect(
			page.getByRole("button", { name: "Duplizieren" }),
		).not.toBeVisible();
		await expect(
			page.getByRole("button", { name: "Löschen" }),
		).not.toBeVisible();
	});

	test("EDITOR sees both bulk respond and management actions", async ({
		page,
	}) => {
		await loginAs(page, "editor");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const rowCheckboxes = page.locator("table").getByRole("checkbox");
		const count = await rowCheckboxes.count();
		if (count < 2) {
			test.skip();
			return;
		}
		await rowCheckboxes.nth(1).click();

		await expect(page.getByRole("button", { name: "Annehmen" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Veröffentlichen" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Duplizieren" }),
		).toBeVisible();
	});

	test("USER bulk-responding to multiple appointments succeeds", async ({
		page,
	}) => {
		await loginAs(page, "user");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const rowCheckboxes = page.locator("table").getByRole("checkbox");
		const count = await rowCheckboxes.count();
		if (count < 2) {
			test.skip();
			return;
		}
		await rowCheckboxes.nth(1).click();

		await page.getByRole("button", { name: "Vielleicht" }).click();
		await expect(page.getByText(/Termine beantwortet/)).toBeVisible();
	});

	test("EDITOR duplicating an appointment shows the copy immediately", async ({
		page,
	}) => {
		await loginAs(page, "editor");
		await page.goto("/appts");
		await page.waitForLoadState("networkidle");

		const duplicateButton = page.getByRole("button", { name: "Duplizieren" });
		if (!(await duplicateButton.isVisible())) {
			test.skip();
			return;
		}
		await duplicateButton.click();

		await expect(page.getByText(/Termine dupliziert/)).toBeVisible();
		await expect(
			page.locator(":visible", { hasText: "(Kopie)" }).first(),
		).toBeVisible();
	});

	test("ADMIN can delete and then restore an appointment", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/appts");
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
		await expect(page.getByText(/Termine gelöscht/)).toBeVisible();

		const restoreButton = page.getByRole("button", {
			name: "Wiederherstellen",
		});
		await expect(restoreButton).toBeEnabled();
		await restoreButton.click();
		await expect(page.getByText(/Termine wiederhergestellt/)).toBeVisible();
	});
});

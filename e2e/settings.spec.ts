import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { loginAs } from "./helpers";

test.describe("Settings - Profile Route", () => {
	test("ADMIN can access profile settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access profile settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER can access profile settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/profile");
		await expect(page).toHaveURL("/settings/profile");
		await expect(page.locator("body")).toBeVisible();
	});
});

test.describe("Settings - Notification Muting by Label", () => {
	const LABEL_PREFIX = "E2EMUTE-";

	test.beforeAll(async () => {
		await prismaClient.userMutedLabel.deleteMany({
			where: { label: { name: { startsWith: LABEL_PREFIX } } },
		});
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
	});

	test.afterAll(async () => {
		await prismaClient.userMutedLabel.deleteMany({
			where: { label: { name: { startsWith: LABEL_PREFIX } } },
		});
		await prismaClient.label.deleteMany({
			where: { name: { startsWith: LABEL_PREFIX } },
		});
		await prismaClient.$disconnect();
	});

	test("USER can mute a label and the selection persists across a reload", async ({
		page,
	}) => {
		const labelName = `${LABEL_PREFIX}Mute`;
		await prismaClient.label.create({
			data: { color: "mauve", name: labelName },
		});

		await loginAs(page, "user");
		await page.goto("/settings/profile");
		await page.waitForLoadState("networkidle");

		const section = page.getByTestId("muted-labels-section");
		await expect(
			section.getByText("Turniere nach Label stummschalten"),
		).toBeVisible();

		const labelInput = section.getByPlaceholder("Label suchen…");
		await labelInput.fill(labelName);
		await section.getByRole("button", { exact: true, name: labelName }).click();

		await section.getByRole("button", { name: "Aktualisieren" }).click();
		await expect(page.getByText("Einstellungen aktualisiert")).toBeVisible();

		await page.reload();
		await page.waitForLoadState("networkidle");
		const reloadedSection = page.getByTestId("muted-labels-section");
		await expect(
			reloadedSection.getByRole("button", { name: "Aktualisieren" }),
		).toBeDisabled();
		await expect(reloadedSection.getByText(labelName)).toBeVisible();
	});

	test("USER cannot quick-create a label from the muting picker", async ({
		page,
	}) => {
		await loginAs(page, "user");
		await page.goto("/settings/profile");
		await page.waitForLoadState("networkidle");

		const section = page.getByTestId("muted-labels-section");
		const labelInput = section.getByPlaceholder("Label suchen…");
		await labelInput.fill(`${LABEL_PREFIX}NoSuchLabel`);
		await expect(
			section.getByRole("button", {
				name: `„${LABEL_PREFIX}NoSuchLabel“ erstellen`,
			}),
		).not.toBeVisible();
	});
});

test.describe("Settings - Imports Route", () => {
	test("ADMIN can access imports settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access imports settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER cannot access imports settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/imports");
		await expect(page).toHaveURL("/settings/imports");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});
});

test.describe("Settings - User Management Route (ADMIN Only)", () => {
	test("ADMIN can access user management", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		const content = (await page.locator("body").textContent()) || "";
		expect(content.length).toBeGreaterThan(0);
	});

	test("EDITOR cannot access user management", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});

	test("USER cannot access user management", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/users");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/users");
		await expect(page.locator("body")).toBeVisible();
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});
});

import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { loginAs } from "./helpers";

// Fixture labels created by this spec are named with this prefix so tests
// can find their own rows regardless of leftover state from other runs, and
// so cleanup only ever removes what this spec created.
const LABEL_PREFIX = "E2ELABEL-";

test.beforeAll(async () => {
	await prismaClient.label.deleteMany({
		where: { name: { startsWith: LABEL_PREFIX } },
	});
});

test.afterAll(async () => {
	await prismaClient.label.deleteMany({
		where: { name: { startsWith: LABEL_PREFIX } },
	});
	await prismaClient.$disconnect();
});

test.describe("Labels Route - Access Control", () => {
	test("ADMIN can access label settings", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/labels");
		await expect(page).toHaveURL("/settings/labels");
		await expect(page.locator("body")).toBeVisible();
	});

	test("EDITOR can access label settings", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/labels");
		await expect(page).toHaveURL("/settings/labels");
		await expect(page.locator("body")).toBeVisible();
	});

	test("USER cannot access label settings", async ({ page }) => {
		await loginAs(page, "user");
		await page.goto("/settings/labels");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL("/settings/labels");
		await expect(page.locator("text=Du hast keine Berechtigung")).toBeVisible();
	});
});

test.describe("Labels Route - Create, Rename, Delete", () => {
	test("EDITOR can create a label", async ({ page }) => {
		const name = `${LABEL_PREFIX}Create`;

		await loginAs(page, "editor");
		await page.goto("/settings/labels");
		await page.waitForLoadState("networkidle");

		await page.getByTitle("Erstellen").click();
		const createDialog = page.getByRole("dialog");
		await createDialog.locator('input[id="name"]').fill(name);
		await createDialog.getByRole("button", { name: "rosewater" }).click();
		await createDialog.getByRole("button", { name: "Erstellen" }).click();

		await expect(page.getByText(name)).toBeVisible();
	});

	test("EDITOR can rename a label", async ({ page }) => {
		const originalName = `${LABEL_PREFIX}RenameSrc`;
		const updatedName = `${LABEL_PREFIX}RenameDst`;
		await prismaClient.label.create({
			data: { color: "blue", name: originalName },
		});

		await loginAs(page, "editor");
		await page.goto("/settings/labels");
		await page.waitForLoadState("networkidle");

		await page.getByText(originalName).click();
		await page.getByTitle("Label umbenennen").click();

		const renameDialog = page.getByRole("dialog");
		const nameInput = renameDialog.locator('input[id="name"]');
		await expect(nameInput).toHaveValue(originalName);
		await nameInput.fill(updatedName);
		await renameDialog.getByRole("button", { name: "Speichern" }).click();

		await expect(page.getByText(updatedName)).toBeVisible();
		await expect(page.getByText(originalName)).not.toBeVisible();
	});

	test("EDITOR can delete a label with confirmation", async ({ page }) => {
		const name = `${LABEL_PREFIX}Delete`;
		await prismaClient.label.create({ data: { color: "green", name } });

		await loginAs(page, "editor");
		await page.goto("/settings/labels");
		await page.waitForLoadState("networkidle");

		await page.getByText(name).click();
		await page.getByTitle("Löschen").click();

		const confirmDialog = page.getByRole("dialog");
		await expect(confirmDialog).toBeVisible();
		await confirmDialog.getByRole("button", { name: "Löschen" }).click();

		await expect(page.getByText(name)).not.toBeVisible();
	});

	test("deleting a label removes it from an appointment it was attached to", async ({
		page,
	}) => {
		const name = `${LABEL_PREFIX}Cascade`;
		const label = await prismaClient.label.create({
			data: { color: "peach", name },
		});
		const season = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const appointment = await prismaClient.appointment.create({
			data: {
				labels: { create: { labelId: label.id } },
				seasonId: season.id,
				startDate: new Date(),
				status: "DRAFT",
				title: `${LABEL_PREFIX}Appointment`,
				type: "TOURNAMENT",
			},
		});

		await loginAs(page, "editor");
		await page.goto("/settings/labels");
		await page.waitForLoadState("networkidle");

		await page.getByText(name).click();
		await page.getByTitle("Löschen").click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: "Löschen" })
			.click();
		await expect(page.getByText(name)).not.toBeVisible();

		const remaining = await prismaClient.appointmentLabel.findMany({
			where: { appointmentId: appointment.id },
		});
		expect(remaining).toHaveLength(0);

		await prismaClient.appointment.delete({ where: { id: appointment.id } });
	});
});

import { expect, type Page } from "@playwright/test";
import { prismaClient } from "../src/lib/db";

/**
 * Helper functions for E2E testing
 * Used across multiple test files
 */

export type UserRole = "admin" | "editor" | "user";

export interface TestUser {
	username: string;
	password: string;
	role: "ADMIN" | "EDITOR" | "USER";
}

export const TEST_USERS: Record<UserRole, TestUser> = {
	admin: {
		password: "password123",
		role: "ADMIN",
		username: "admin",
	},
	editor: {
		password: "password123",
		role: "EDITOR",
		username: "editor",
	},
	user: {
		password: "password123",
		role: "USER",
		username: "user",
	},
};

/**
 * Login as a specific user
 */
export async function loginAs(page: Page, role: UserRole | string) {
	const testUser =
		typeof role === "string" && role in TEST_USERS
			? TEST_USERS[role as UserRole]
			: null;
	const username = testUser ? testUser.username : role;
	const password = testUser ? testUser.password : "password123";

	await page.goto("/");
	await page.waitForLoadState("networkidle");

	// Check if already logged in by looking for the app shell (authenticated layout)
	const hasNavigation = await page
		.locator("main")
		.isVisible({ timeout: 2000 })
		.catch(() => false);
	if (hasNavigation) {
		// Already logged in, logout first
		await page.goto("/logout", { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(1000);
		await page.goto("/");
		await page.waitForLoadState("networkidle");
	}

	// Wait for the login form to be visible
	const loginForm = page.locator("form").first();
	await loginForm.waitFor({ state: "visible", timeout: 10000 });

	// Fill in the form fields
	await page.locator('input[name="userName"]').fill(username);
	await page.locator('input[name="password"]').fill(password);

	// Wait a moment for the form state to update
	await page.waitForTimeout(500);

	// Now click the submit button and wait for the navigation/response
	const submitButton = page.locator('button[type="submit"]');

	// Click and wait for the authenticated page to load (app shell appears)
	await submitButton.click();
	await page.waitForSelector("main", { timeout: 15000 });
}

/**
 * Deletes any appointments (and their dependent Transaction/Response/Placement
 * rows) whose shortTitle starts with `prefix`. Shared by the seed-*.ts
 * fixture scripts to clear leftovers from a previous run before seeding fresh
 * data — Transaction/Response/Placement rows reference the appointment id and
 * aren't cascade-deleted, so they'd otherwise leave a dangling FK once a
 * previous run's soft-deleted appointments (which also log a Transaction per
 * row, e.g. via bulkDeleteAppointments) are hard-deleted below.
 */
export async function cleanupByShortTitlePrefix(prefix: string) {
	const staleIds = await prismaClient.appointment.findMany({
		select: { id: true },
		where: { shortTitle: { startsWith: prefix } },
	});
	const staleWhere = { appointmentId: { in: staleIds.map((a) => a.id) } };
	await prismaClient.transaction.deleteMany({ where: staleWhere });
	await prismaClient.response.deleteMany({ where: staleWhere });
	await prismaClient.placement.deleteMany({ where: staleWhere });
	await prismaClient.appointment.deleteMany({
		where: { shortTitle: { startsWith: prefix } },
	});
}

/**
 * Reads the "N von M Ereignissen" summary text shown at the top of the
 * bulk/trash/journal appointment lists and parses out the matched/total
 * counts. Shared by appointments-bulk.spec.ts, appointments-trash.spec.ts,
 * and journal.spec.ts, which all render the same summary shape.
 */
export async function readSummary(page: Page) {
	const summary = page.getByText(/\d+ von \d+ Ereignissen/);
	await expect(summary).toBeVisible();
	const text = await summary.textContent();
	return {
		matched: Number(text?.match(/^(\d+) von/)?.[1]),
		total: Number(text?.match(/von (\d+) Ereignissen/)?.[1]),
	};
}

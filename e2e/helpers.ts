import type { Page } from "@playwright/test";

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

	// Check if already logged in by looking for the nav (authenticated layout)
	const hasNavigation = await page
		.locator("nav")
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

	// Click and wait for the authenticated page to load (nav appears)
	await submitButton.click();
	await page.waitForSelector("nav", { timeout: 15000 });
}

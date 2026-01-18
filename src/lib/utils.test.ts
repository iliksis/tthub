import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserInvitation } from "./prisma/client";
import { Role } from "./prisma/enums";
import {
	calculateAgeGroup,
	compareRoles,
	createColorForUserId,
	createGoogleMapsLink,
	dateToInputValue,
	format,
	isDayInPast,
	isInvitationExpired,
} from "./utils";

describe("isInvitationExpired", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("should return false for recent invitation", () => {
		const now = new Date("2026-01-17T12:00:00Z");
		vi.setSystemTime(now);

		const invitation: UserInvitation = {
			createdAt: new Date("2026-01-15T12:00:00Z"),
			id: "1",
			userId: "user-1",
		};

		expect(isInvitationExpired(invitation)).toBe(false);
	});

	it("should return true for expired invitation", () => {
		const now = new Date("2026-01-17T12:00:00Z");
		vi.setSystemTime(now);

		const invitation: UserInvitation = {
			createdAt: new Date("2026-01-10T12:00:00Z"),
			id: "1",
			userId: "user-1",
		};

		expect(isInvitationExpired(invitation)).toBe(true);
	});

	it("should return false for invitation exactly 3 days old", () => {
		const now = new Date("2026-01-17T12:00:00Z");
		vi.setSystemTime(now);

		const invitation: UserInvitation = {
			createdAt: new Date("2026-01-14T12:00:00Z"),
			id: "1",
			userId: "user-1",
		};

		expect(isInvitationExpired(invitation)).toBe(false);
	});
});

describe("compareRoles", () => {
	it("should return 0 for equal roles", () => {
		expect(compareRoles(Role.ADMIN, Role.ADMIN)).toBe(0);
		expect(compareRoles(Role.EDITOR, Role.EDITOR)).toBe(0);
		expect(compareRoles(Role.USER, Role.USER)).toBe(0);
	});

	it("should return 1 when role1 is higher", () => {
		expect(compareRoles(Role.ADMIN, Role.EDITOR)).toBe(1);
		expect(compareRoles(Role.ADMIN, Role.USER)).toBe(1);
		expect(compareRoles(Role.EDITOR, Role.USER)).toBe(1);
	});

	it("should return -1 when role2 is higher", () => {
		expect(compareRoles(Role.EDITOR, Role.ADMIN)).toBe(-1);
		expect(compareRoles(Role.USER, Role.ADMIN)).toBe(-1);
		expect(compareRoles(Role.USER, Role.EDITOR)).toBe(-1);
	});
});

describe("dateToInputValue", () => {
	it("should format date correctly", () => {
		const date = new Date("2026-01-17T11:30:45Z");
		const result = dateToInputValue(date);
		// Should be in format YYYY-MM-DDTHH:MM:SS
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
		expect(result).toContain("2026-01-17");
	});

	it("should format date without seconds when specified", () => {
		const date = new Date("2026-01-17T10:30:45Z");
		const result = dateToInputValue(date, false);
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("should handle timezone offset correctly", () => {
		const date = new Date("2026-01-17T00:00:00Z");
		const result = dateToInputValue(date);
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");
	});
});

describe("isDayInPast", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("should return true for past date", () => {
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
		const pastDate = new Date("2026-01-15T10:00:00Z");
		expect(isDayInPast(pastDate)).toBe(true);
	});

	it("should return false for today", () => {
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
		const today = new Date("2026-01-17T08:00:00Z");
		expect(isDayInPast(today)).toBe(false);
	});

	it("should return false for future date", () => {
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
		const futureDate = new Date("2026-01-20T10:00:00Z");
		expect(isDayInPast(futureDate)).toBe(false);
	});
});

describe("createGoogleMapsLink", () => {
	it("should create a valid Google Maps search link", () => {
		const location = "Berlin, Germany";
		const result = createGoogleMapsLink(location);
		expect(result).toBe(
			"https://www.google.com/maps/search/?api=1&query=Berlin, Germany",
		);
	});

	it("should handle special characters", () => {
		const location = "München & Co.";
		const result = createGoogleMapsLink(location);
		expect(result).toContain("München & Co.");
	});
});

describe("createColorForUserId", () => {
	it("should create a valid hex color", () => {
		const userId = "user123";
		const color = createColorForUserId(userId);
		expect(color).toMatch(/^#[0-9a-f]{6}$/);
	});

	it("should create consistent colors for same user ID", () => {
		const userId = "user123";
		const color1 = createColorForUserId(userId);
		const color2 = createColorForUserId(userId);
		expect(color1).toBe(color2);
	});

	it("should create different colors for different user IDs", () => {
		const color1 = createColorForUserId("user1");
		const color2 = createColorForUserId("user2");
		expect(color1).not.toBe(color2);
	});
});

describe("format", () => {
	it("should replace single placeholder", () => {
		const result = format("Hello {0}", "World");
		expect(result).toBe("Hello World");
	});

	it("should replace multiple placeholders", () => {
		const result = format("{0} has {1} appointments", "John", "5");
		expect(result).toBe("John has 5 appointments");
	});

	it("should handle missing values", () => {
		const result = format("Hello {0} and {1}", "World");
		expect(result).toBe("Hello World and {1}");
	});

	it("should handle no placeholders", () => {
		const result = format("Hello World");
		expect(result).toBe("Hello World");
	});

	it("should handle out of order placeholders", () => {
		const result = format("{1} {0}", "World", "Hello");
		expect(result).toBe("Hello World");
	});
});

describe("calculateAgeGroup", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
	});

	it("should return U11 for 10 year olds", () => {
		expect(calculateAgeGroup(2016)).toBe("U11");
	});

	it("should return U13 for 12 year olds", () => {
		expect(calculateAgeGroup(2014)).toBe("U13");
	});

	it("should return U15 for 13-14 year olds", () => {
		expect(calculateAgeGroup(2013)).toBe("U15");
		expect(calculateAgeGroup(2012)).toBe("U15");
	});

	it("should return U19 for 15-18 year olds", () => {
		expect(calculateAgeGroup(2010)).toBe("U19");
		expect(calculateAgeGroup(2008)).toBe("U19");
	});

	it("should return Adult for 19+ year olds", () => {
		expect(calculateAgeGroup(2007)).toBe("Erwachsen");
		expect(calculateAgeGroup(2000)).toBe("Erwachsen");
		expect(calculateAgeGroup(1990)).toBe("Erwachsen");
	});
});

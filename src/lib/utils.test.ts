import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserInvitation } from "./prisma/client";
import { Role } from "./prisma/enums";
import {
	ageGroupLabel,
	calculateAgeGroup,
	compareRoles,
	createColorForUserId,
	createGoogleMapsLink,
	dateToInputValue,
	formatDateWithYear,
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
			"https://www.google.com/maps/search/?api=1&query=Berlin%2C%20Germany",
		);
	});

	it("should encode special characters", () => {
		const location = "München & Co.";
		const result = createGoogleMapsLink(location);
		expect(result).toBe(
			"https://www.google.com/maps/search/?api=1&query=M%C3%BCnchen%20%26%20Co.",
		);
	});
});

describe("createColorForUserId", () => {
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

describe("calculateAgeGroup", () => {
	const ref = 2026;

	it("should return U11 up to age 10", () => {
		expect(calculateAgeGroup(2016, ref)).toBe("U11");
		expect(calculateAgeGroup(2026, ref)).toBe("U11");
	});

	it("should switch from U11 to U13 at age 11", () => {
		expect(calculateAgeGroup(2015, ref)).toBe("U13");
	});

	it("should return U13 up to age 12", () => {
		expect(calculateAgeGroup(2014, ref)).toBe("U13");
	});

	it("should switch from U13 to U15 at age 13", () => {
		expect(calculateAgeGroup(2013, ref)).toBe("U15");
	});

	it("should return U15 up to age 14", () => {
		expect(calculateAgeGroup(2012, ref)).toBe("U15");
	});

	it("should switch from U15 to U19 at age 15", () => {
		expect(calculateAgeGroup(2011, ref)).toBe("U19");
	});

	it("should return U19 up to age 18", () => {
		expect(calculateAgeGroup(2008, ref)).toBe("U19");
	});

	it("should switch from U19 to ADULT at age 19", () => {
		expect(calculateAgeGroup(2007, ref)).toBe("ADULT");
	});

	it("should return ADULT for older players", () => {
		expect(calculateAgeGroup(2000, ref)).toBe("ADULT");
		expect(calculateAgeGroup(1990, ref)).toBe("ADULT");
	});

	it("should use the given reference year", () => {
		expect(calculateAgeGroup(2016, 2030)).toBe("U15");
	});
});

describe("ageGroupLabel", () => {
	it("should return the key for youth groups", () => {
		expect(ageGroupLabel("U11")).toBe("U11");
		expect(ageGroupLabel("U19")).toBe("U19");
	});

	it("should return the translated adult label for ADULT", () => {
		expect(ageGroupLabel("ADULT")).toBe("Erwachsen");
	});
});

describe("formatDateWithYear", () => {
	it("formats as dd.mm.yyyy", () => {
		expect(formatDateWithYear(new Date("2026-03-07T12:00:00Z"))).toBe(
			"07.03.2026",
		);
	});

	it("uses the club's time zone, not the runtime's", () => {
		// 23:30 UTC on 4 Nov is already 5 Nov in Berlin.
		expect(formatDateWithYear(new Date("2026-11-04T23:30:00Z"))).toBe(
			"05.11.2026",
		);
	});
});

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FileRouteTypes } from "@/routeTree.gen";
import type { UserInvitation } from "./prisma/client";
import { Role } from "./prisma/enums";
import { t } from "./text";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const expirationDays = 3;
export const isInvitationExpired = (invitation: UserInvitation) => {
	const expirationDate = new Date(invitation.createdAt);
	expirationDate.setDate(expirationDate.getDate() + expirationDays);
	return expirationDate < new Date();
};

/**
 * Compares two roles. Return 0 if they are equal, 1 if role1 is higher, and -1 if role2 is higher.
 * Admin > Editor > User
 */
export const compareRoles = (role1: Role, role2: Role) => {
	if (role1 === role2) return 0;
	if (role1 === Role.ADMIN) return 1;
	if (role2 === Role.ADMIN) return -1;
	if (role1 === Role.EDITOR) return 1;
	if (role2 === Role.EDITOR) return -1;
	return 1;
};

/**
 * Converts a date to an input value for a date input field.
 */
export const dateToInputValue = (date: Date, withSeconds = true) => {
	const offset = date.getTimezoneOffset() * 60 * 1000;
	const offsetDate = new Date(date.getTime() - offset);
	const isoString = offsetDate.toISOString().slice(0, -1);
	if (withSeconds) return isoString.slice(0, -4);
	return isoString.split("T")[0];
};

/**
 * Checks if a date is in the past.
 */
export const isDayInPast = (date: Date) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const inputDate = new Date(date);
	inputDate.setHours(0, 0, 0, 0);
	return inputDate < today;
};

/**
 * Creates a Google Maps link for a given location.
 */
export const createGoogleMapsLink = (location: string) => {
	return `https://www.google.com/maps/search/?api=1&query=${location}`;
};

const colorNames = [
	"rosewater",
	"flamingo",
	"pink",
	"mauve",
	"red",
	"maroon",
	"peach",
	"yellow",
	"green",
	"teal",
	"sky",
	"sapphire",
	"blue",
	"lavender",
];

const userColors: {
	[key: (typeof colorNames)[number]]: {
		backgroundColor: string;
		foregroundColor: string;
	};
} = {
	blue: {
		backgroundColor: "var(--catppuccin-color-blue-100)",
		foregroundColor: "var(--catppuccin-color-blue-900)",
	},
	flamingo: {
		backgroundColor: "var(--catppuccin-color-flamingo-100)",
		foregroundColor: "var(--catppuccin-color-flamingo-900)",
	},
	green: {
		backgroundColor: "var(--catppuccin-color-green-100)",
		foregroundColor: "var(--catppuccin-color-green-900)",
	},
	lavender: {
		backgroundColor: "var(--catppuccin-color-lavender-100)",
		foregroundColor: "var(--catppuccin-color-lavender-900)",
	},
	maroon: {
		backgroundColor: "var(--catppuccin-color-maroon-100)",
		foregroundColor: "var(--catppuccin-color-maroon-900)",
	},
	mauve: {
		backgroundColor: "var(--catppuccin-color-mauve-100)",
		foregroundColor: "var(--catppuccin-color-mauve-900)",
	},
	peach: {
		backgroundColor: "var(--catppuccin-color-peach-100)",
		foregroundColor: "var(--catppuccin-color-peach-900)",
	},
	pink: {
		backgroundColor: "var(--catppuccin-color-pink-100)",
		foregroundColor: "var(--catppuccin-color-pink-900)",
	},
	red: {
		backgroundColor: "var(--catppuccin-color-red-100)",
		foregroundColor: "var(--catppuccin-color-red-900)",
	},
	rosewater: {
		backgroundColor: "var(--catppuccin-color-rosewater-100)",
		foregroundColor: "var(--catppuccin-color-rosewater-900)",
	},
	sapphire: {
		backgroundColor: "var(--catppuccin-color-sapphire-100)",
		foregroundColor: "var(--catppuccin-color-sapphire-900)",
	},
	sky: {
		backgroundColor: "var(--catppuccin-color-sky-100)",
		foregroundColor: "var(--catppuccin-color-sky-900)",
	},
	teal: {
		backgroundColor: "var(--catppuccin-color-teal-100)",
		foregroundColor: "var(--catppuccin-color-teal-900)",
	},
	yellow: {
		backgroundColor: "var(--catppuccin-color-yellow-100)",
		foregroundColor: "var(--catppuccin-color-yellow-900)",
	},
};

/**
 * Creates a color based on the user's id.
 * Picks from a predefined set of catppuccin colors.
 */
export const createColorForUserId = (userId: string) => {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}

	const index = Math.abs(hash) % colorNames.length;
	return userColors[colorNames[index]];
};

/**
 * Formats a string with numeric placeholders (e.g. {0}, {1}, ...) and replaces them with the provided values.
 */
export const format = (str: string, ...values: string[]) => {
	return str.replace(/{(\d+)}/g, (match, index) => {
		return typeof values[index] !== "undefined" ? values[index] : match;
	});
};

export const formatTanstackRouterPath = (
	path: FileRouteTypes["fullPaths"],
	params: Record<string, string>,
) => {
	const keys = Object.keys(params);
	const values = Object.values(params);
	return path
		.replace(/\/$/, "")
		.replace(new RegExp(`\\$${keys.join("|\\$")}`, "g"), (match, index) => {
			return values[index] ?? match;
		});
};

export const calculateAgeGroup = (year: number) => {
	const currentYear = new Date().getFullYear();
	const age = currentYear - year;

	if (age < 11) return "U11";
	if (age < 13) return "U13";
	if (age < 15) return "U15";
	if (age < 19) return "U19";
	return t("Adult");
};

export const shortenUserName = (name: string) => {
	const parts = name.split(" ");
	if (parts.length === 1) return parts[0].slice(0, 2);
	return parts[0][0] + parts[1][0];
};

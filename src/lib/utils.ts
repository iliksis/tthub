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

/**
 * Creates a color based on the user's id.
 * Ensures colors are not too light to maintain readability with white text.
 */
export const createColorForUserId = (userId: string) => {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Generate base RGB values
	const r = (hash >> 16) & 0xff;
	const g = (hash >> 8) & 0xff;
	const b = hash & 0xff;

	// Convert to HSL to adjust lightness
	const rNorm = r / 255;
	const gNorm = g / 255;
	const bNorm = b / 255;

	const max = Math.max(rNorm, gNorm, bNorm);
	const min = Math.min(rNorm, gNorm, bNorm);
	const l = (max + min) / 2;

	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case rNorm:
				h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
				break;
			case gNorm:
				h = ((bNorm - rNorm) / d + 2) / 6;
				break;
			case bNorm:
				h = ((rNorm - gNorm) / d + 4) / 6;
				break;
		}
	}

	// Ensure lightness is in a safe range (30-55%) for white text readability
	// This range works well in both light and dark themes
	const adjustedL = 0.3 + l * 0.25;

	// Convert HSL back to RGB
	const hslToRgb = (h: number, s: number, l: number) => {
		const hue2rgb = (p: number, q: number, t: number) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};

		if (s === 0) {
			return [l, l, l];
		}

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		return [
			hue2rgb(p, q, h + 1 / 3),
			hue2rgb(p, q, h),
			hue2rgb(p, q, h - 1 / 3),
		];
	};

	const [rFinal, gFinal, bFinal] = hslToRgb(h, s, adjustedL);

	// Convert back to hex
	const toHex = (n: number) =>
		Math.round(n * 255)
			.toString(16)
			.padStart(2, "0");

	return `#${toHex(rFinal)}${toHex(gFinal)}${toHex(bFinal)}`;
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

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UserInvitation } from "./prisma/client";
import { Role } from "./prisma/enums";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const expirationDays = 3;
export const isInvitationExpired = (invitation: UserInvitation) => {
	const expirationDate = invitation.createdAt;
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
 */
export const createColorForUserId = (userId: string) => {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}
	let color = "#";
	for (let i = 0; i < 3; i++) {
		const value = (hash >> (i * 8)) & 0xff;
		color += `00${value.toString(16)}`.slice(-2);
	}
	return color;
};

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

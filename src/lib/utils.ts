import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UserInvitation } from "./prisma/client";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const expirationDays = 3;
export const isInvitationExpired = (invitation: UserInvitation) => {
	const expirationDate = invitation.createdAt;
	expirationDate.setDate(expirationDate.getDate() + expirationDays);
	return expirationDate < new Date();
};

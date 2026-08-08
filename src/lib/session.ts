import { useSession } from "@tanstack/react-start/server";
import type { User } from "@/lib/prisma/client";
import { compareRoles } from "./utils";

export type SessionUser = {
	userName: User["userName"];
	name: User["name"];
	id: User["id"];
	role: User["role"];
};

export const useAppSession = () => {
	return useSession<SessionUser>({
		maxAge: 60 * 60 * 24 * 14, // 2 weeks
		name: "tthub-session",
		password: process.env.SESSION_PASSWORD,
	});
};

export const useIsRole = async (role: User["role"]) => {
	const { data } = await useAppSession();
	if (data.id === null || data.role === undefined) return false;
	const compare = compareRoles(data.role, role);
	return compare !== -1;
};

export const useIsUserOrRole = async (
	userId: User["id"],
	role: User["role"],
) => {
	const { data } = await useAppSession();
	if (data.id === null) {
		return false;
	}
	return data.id === userId || data.role === role;
};

// Shared by every Appointment-mutating server function: EDITOR+ role AND a
// present session.id. Returns the session on success, null otherwise so
// callers can build their own `Return`/status-401 response.
export const requireEditor = async (): Promise<
	(Partial<SessionUser> & { id: string }) | null
> => {
	const isAuthorized = await useIsRole("EDITOR");
	const { data: session } = await useAppSession();
	if (!isAuthorized || !session.id) return null;
	return { ...session, id: session.id };
};

import { useSession } from "@tanstack/react-start/server";
import type { User } from "@/lib/prisma/client";
import { compareRoles } from "./utils";

export type SessionUser = {
	userName: User["userName"];
	name: User["name"];
	id: User["id"];
	role: User["role"];
};

export function useAppSession() {
	return useSession<SessionUser>({
		name: "tthub-session",
		password: "ChangeThisBeforeShippingToProdOrYouWillBeFired",
	});
}

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

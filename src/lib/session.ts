import { useSession } from "@tanstack/react-start/server";
import type { User } from "@/lib/prisma/client";

export type SessionUser = {
	userName: User["userName"];
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
	if (data.id === null) {
		return false;
	}
	return data.role === role;
};

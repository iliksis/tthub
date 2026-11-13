import { useSession } from "@tanstack/react-start/server";
import type { User } from "@/lib/prisma/client";

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

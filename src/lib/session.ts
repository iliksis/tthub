import type { User } from "@prisma/client";
import { useSession } from "@tanstack/react-start/server";

type SessionUser = {
	userName: User["userName"];
};

export function useAppSession() {
	return useSession<SessionUser>({
		name: "tthub-session",
		password: "ChangeThisBeforeShippingToProdOrYouWillBeFired",
	});
}

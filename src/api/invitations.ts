import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { InvitationsApi } from "./invitations.server";
import { run } from "./kernel.server";

export const getInvitation = createServerFn({ method: "GET" })
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(InvitationsApi, m.invitations_invitation_loaded, (api) =>
			api.get(data.id),
		),
	);

export const createUserInvitation = createServerFn({ method: "POST" })
	.validator((d: { userId: string }) => d)
	.handler(({ data }) =>
		run(InvitationsApi, m.common_user_updated, (api) =>
			api.create(data.userId),
		),
	);

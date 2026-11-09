import { createServerFn } from "@tanstack/react-start";
import type { FeedConfig } from "@/lib/feed";
import { m } from "@/paraglide/messages";
import { FeedApi } from "./feed.server";
import { InvitationsApi } from "./invitations.server";
import { run } from "./kernel.server";
import { PasswordResetApi } from "./passwordReset.server";
import {
	type CreateUserInput,
	type UserInformationInput,
	UsersApi,
} from "./users.server";

export type { FeedConfig } from "@/lib/feed";

export const fetchUsers = createServerFn({ method: "GET" }).handler(() =>
	run(UsersApi, m.users_users_loaded, (api) => api.list()),
);

export const updateUserRole = createServerFn({ method: "POST" })
	.validator((d: { id: string; role: CreateUserInput["role"] }) => d)
	.handler(({ data }) =>
		run(UsersApi, m.common_user_updated, (api) =>
			api.updateRole(data.id, data.role),
		),
	);

export const updateUserInformation = createServerFn({ method: "POST" })
	.validator((d: UserInformationInput) => d)
	.handler(({ data }) =>
		run(UsersApi, m.common_settings_updated, (api) =>
			api.updateInformation(data),
		),
	);

export const createUser = createServerFn({ method: "POST" })
	.validator((d: CreateUserInput) => d)
	.handler(({ data }) =>
		run(UsersApi, m.users_user_created, (api) => api.create(data)),
	);

export const createUserFromInvitation = createServerFn({ method: "POST" })
	.validator(
		(d: { invitationId: string; password: string; confirmPassword: string }) =>
			d,
	)
	.handler(({ data }) =>
		run(InvitationsApi, m.users_user_created, (api) =>
			api.accept(data.invitationId, data.password, data.confirmPassword),
		),
	);

export const deleteUser = createServerFn({ method: "POST" })
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(UsersApi, m.users_user_deleted, (api) => api.delete(data.id)),
	);

export const updatePasswordFromReset = createServerFn({ method: "POST" })
	.validator(
		(d: { resetId: string; password: string; confirmPassword: string }) => d,
	)
	.handler(({ data }) =>
		run(PasswordResetApi, m.common_user_updated, (api) =>
			api.complete(data.resetId, data.password, data.confirmPassword),
		),
	);

export const getFeedConfig = createServerFn({ method: "GET" }).handler(() =>
	run(FeedApi, m.users_feed_config_loaded, (api) => api.getConfig()),
);

export const updateFeedConfig = createServerFn({ method: "POST" })
	.validator((d: FeedConfig) => d)
	.handler(({ data }) =>
		run(FeedApi, m.users_feed_settings_updated, (api) =>
			api.updateConfig(data),
		),
	);

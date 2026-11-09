import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { PasswordResetApi } from "./passwordReset.server";

export const getPasswordReset = createServerFn({ method: "GET" })
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(PasswordResetApi, m.users_password_reset_loaded, (api) =>
			api.get(data.id),
		),
	);

export const createPasswordReset = createServerFn({ method: "POST" })
	.validator((d: { userId: string }) => d)
	.handler(({ data }) =>
		run(PasswordResetApi, m.common_user_updated, (api) =>
			api.create(data.userId),
		),
	);

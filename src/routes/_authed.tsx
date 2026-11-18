import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthApi } from "@/api/auth.server";
import { run } from "@/api/kernel.server";
import { Login } from "@/components/Login";
import { m } from "@/paraglide/messages";

export const loginFn = createServerFn({ method: "POST" })
	.validator((d: { userName: string; password: string }) => d)
	.handler(({ data }) =>
		run(AuthApi, m.auth_logged_in, (api) =>
			api.login(data.userName, data.password),
		),
	);

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw new Error(m.auth_not_authenticated());
		}
	},
	errorComponent: ({ error }) => {
		if (error.message === m.auth_not_authenticated()) {
			return <Login />;
		}
		throw error;
	},
});

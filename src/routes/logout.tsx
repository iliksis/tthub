import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthApi } from "@/api/auth.server";
import { run } from "@/api/kernel.server";
import { m } from "@/paraglide/messages";

const logoutFn = createServerFn().handler(() =>
	run(AuthApi, m.auth_logged_out, (api) => api.logout()),
);
export const Route = createFileRoute("/logout")({
	loader: async () => {
		await logoutFn();
		throw redirect({ replace: true, to: "/" });
	},
	preload: false,
});

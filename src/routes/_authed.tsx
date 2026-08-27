import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Login } from "@/components/Login";
import { hashPassword, prismaClient } from "@/lib/db";
import { useAppSession } from "@/lib/session";
import { m } from "@/paraglide/messages";

export const loginFn = createServerFn({ method: "POST" })
	.validator((d: { userName: string; password: string }) => d)
	.handler(async ({ data }) => {
		const user = await prismaClient.user.findUnique({
			where: {
				userName: data.userName,
			},
		});

		const session = await useAppSession();

		const hashedPassword = await hashPassword(data.password);

		if (!user || user.password !== hashedPassword) {
			session.clear();
			return {
				error: true,
				message: m.auth_incorrect_user_name_or_password(),
			};
		}
		await session.update(user);
	});

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

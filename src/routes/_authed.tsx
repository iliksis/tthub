import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Login } from "@/components/Login";
import { hashPassword, prismaClient } from "@/lib/db";
import { useAppSession } from "@/lib/session";
import { t } from "@/lib/text";

export const loginFn = createServerFn({ method: "POST" })
	.inputValidator((d: { userName: string; password: string }) => d)
	.handler(async ({ data }) => {
		// Find the user
		const user = await prismaClient.user.findUnique({
			where: {
				userName: data.userName,
			},
		});

		const session = await useAppSession();

		// Check if the password is correct
		const hashedPassword = await hashPassword(data.password);

		if (!user || user.password !== hashedPassword) {
			session.clear();
			return {
				error: true,
				message: t("Incorrect user name or password"),
			};
		}

		// Store the user's email in the session
		await session.update(user);
	});

export const Route = createFileRoute("/_authed")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw new Error(t("Not authenticated"));
		}
	},
	errorComponent: ({ error }) => {
		if (error.message === t("Not authenticated")) {
			return <Login />;
		}

		throw error;
	},
});

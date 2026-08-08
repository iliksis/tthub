import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

export const getPasswordReset = createServerFn({ method: "GET" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const invitation = await prismaClient.passwordReset.findUnique({
			include: {
				user: true,
			},
			where: {
				id: data.id,
			},
		});
		return invitation;
	});

export const createPasswordReset = createServerFn({ method: "POST" })
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const existing = await prismaClient.passwordReset.findUnique({
				where: {
					userId: data.userId,
				},
			});
			if (existing) {
				await prismaClient.passwordReset.delete({
					where: {
						userId: data.userId,
					},
				});
			}
			const invitation = await prismaClient.passwordReset.create({
				data: {
					userId: data.userId,
				},
			});
			return { data: invitation, message: t("User updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

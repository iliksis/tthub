import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

export const getInvitation = createServerFn({ method: "GET" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const invitation = await prismaClient.userInvitation.findUnique({
			include: {
				user: true,
			},
			where: {
				id: data.id,
			},
		});
		return invitation;
	});

export const createUserInvitation = createServerFn({ method: "POST" })
	.inputValidator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			await prismaClient.userInvitation.delete({
				where: {
					userId: data.userId,
				},
			});
			const invitation = await prismaClient.userInvitation.create({
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

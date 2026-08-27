import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { m } from "@/paraglide/messages";

export const getInvitation = createServerFn({ method: "GET" })
	.validator((d: { id: string }) => d)
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
	.validator((d: { userId: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
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
			return { data: invitation, message: m.common_user_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

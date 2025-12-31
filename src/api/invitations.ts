import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { UserInvitation } from "@/lib/prisma/client";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

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
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return<UserInvitation>>(
				{ data: invitation, message: t("User updated") },
				{ status: 401 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

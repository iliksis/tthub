import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import type { PasswordReset } from "@/lib/prisma/client";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

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
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
			return json<Return<PasswordReset>>(
				{ data: invitation, message: t("User updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

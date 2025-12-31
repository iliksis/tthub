import { createServerFn, json } from "@tanstack/react-start";
import { hashPassword, prismaClient } from "@/lib/db";
import type { User } from "@/lib/prisma/client";
import type { Role } from "@/lib/prisma/enums";
import { useAppSession, useIsRole, useIsUserOrRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

export const fetchUsers = createServerFn({ method: "GET" }).handler(
	async () => {
		const users = await prismaClient.user.findMany({
			include: {
				invitation: true,
			},
		});
		return users;
	},
);

export const updateUserRole = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string; role: Role }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const user = await prismaClient.user.update({
				data: {
					role: data.role,
				},
				where: {
					id: data.id,
				},
			});
			return json<Return<User>>(
				{ data: user, message: t("User updated") },
				{ status: 401 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const updateUserInformation = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string; name: string; password: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsUserOrRole(data.id, "ADMIN");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const hashedPassword = await hashPassword(data.password);
			const user = await prismaClient.user.update({
				data: {
					name: data.name,
					password: hashedPassword,
				},
				where: {
					id: data.id,
				},
			});
			return json<Return<User>>(
				{ data: user, message: t("User information updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const createUser = createServerFn({ method: "POST" })
	.inputValidator((d: { userName: string; name: string; role: Role }) => d)
	.handler(async ({ data }) => {
		const isAuthenticated = await useIsRole("ADMIN");
		if (!isAuthenticated) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			const user = await prismaClient.user.create({
				data: {
					invitation: {
						create: {},
					},
					name: data.name,
					role: data.role,
					userName: data.userName,
				},
			});

			return json<Return<User>>(
				{ data: user, message: t("User created") },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const createUserFromInvitation = createServerFn({ method: "POST" })
	.inputValidator((d: { invitationId: string; password: string }) => d)
	.handler(async ({ data }) => {
		try {
			// biome-ignore lint/correctness/useHookAtTopLevel: not a real hook
			const session = await useAppSession();

			const invitation = await prismaClient.userInvitation.findUnique({
				where: {
					id: data.invitationId,
				},
			});
			if (!invitation) {
				return json<Return>(
					{ message: t("Invitation not found") },
					{
						status: 404,
					},
				);
			}

			const hashedPassword = await hashPassword(data.password);
			const user = await prismaClient.user.update({
				data: {
					password: hashedPassword,
				},
				include: {
					invitation: true,
				},
				where: {
					id: invitation.userId,
				},
			});
			if (user.invitation) {
				await prismaClient.userInvitation.delete({
					where: {
						id: data.invitationId,
					},
				});
			}
			await session.update(user);
			return json<Return<User>>(
				{ data: user, message: t("User created") },
				{
					status: 200,
				},
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deleteUser = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
		}

		try {
			await prismaClient.response.deleteMany({
				where: {
					userId: data.id,
				},
			});
			await prismaClient.userInvitation.deleteMany({
				where: {
					userId: data.id,
				},
			});
			await prismaClient.user.delete({
				where: {
					id: data.id,
				},
			});
			return json<Return>({ message: t("User deleted") }, { status: 200 });
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

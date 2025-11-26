import { createServerFn, json } from "@tanstack/react-start";
import { hashPassword, prismaClient } from "@/lib/db";
import type { User } from "@/lib/prisma/client";
import type { Role } from "@/lib/prisma/enums";
import { useIsRole, useIsUserOrRole } from "@/lib/session";
import { loginFn } from "@/routes/_authed";
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const user = await prismaClient.user.update({
				where: {
					id: data.id,
				},
				data: {
					role: data.role,
				},
			});
			return json<Return<User>>(
				{ message: "User updated", data: user },
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const hashedPassword = await hashPassword(data.password);
			const user = await prismaClient.user.update({
				where: {
					id: data.id,
				},
				data: {
					name: data.name,
					password: hashedPassword,
				},
			});
			return json<Return<User>>(
				{ message: "User information updated", data: user },
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const user = await prismaClient.user.create({
				data: {
					userName: data.userName,
					name: data.name,
					role: data.role,
					invitation: {
						create: {},
					},
				},
			});

			return json<Return<User>>(
				{ message: "User created", data: user },
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
			const invitation = await prismaClient.userInvitation.findUnique({
				where: {
					id: data.invitationId,
				},
			});
			if (!invitation) {
				return json<Return>(
					{ message: "Invitation not found" },
					{
						status: 404,
					},
				);
			}

			const hashedPassword = await hashPassword(data.password);
			const user = await prismaClient.user.update({
				where: {
					id: invitation.userId,
				},
				data: {
					password: hashedPassword,
				},
				include: {
					invitation: true,
				},
			});
			if (user.invitation) {
				await prismaClient.userInvitation.delete({
					where: {
						id: data.invitationId,
					},
				});
			}
			await loginFn({
				data: { userName: user.userName, password: data.password },
			});
			return json<Return<User>>(
				{ message: "User created", data: user },
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
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
			return json<Return>({ message: "User deleted" }, { status: 200 });
		} catch (e) {
			console.error(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

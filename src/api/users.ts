import { createServerFn } from "@tanstack/react-start";
import { hashPassword, prismaClient } from "@/lib/db";
import type { AppointmentType, ResponseType, Role } from "@/lib/prisma/enums";
import { useAppSession, useIsRole, useIsUserOrRole } from "@/lib/session";
import { t } from "@/lib/text";

export interface FeedConfig {
	includeResponseTypes?: ResponseType[];
	includeDraftStatus?: boolean;
	includeAppointmentTypes?: AppointmentType[];
}

export const fetchUsers = createServerFn({ method: "GET" }).handler(
	async () => {
		const users = await prismaClient.user.findMany({
			include: {
				invitation: true,
				passwordReset: true,
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
			throw new Error(t("Unauthorized"));
		}

		// biome-ignore lint/correctness/useHookAtTopLevel: not a real hook
		const session = await useAppSession();
		if (session.data?.id === data.id) {
			throw new Error(t("You cannot change your own role"));
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
			return { data: user, message: t("User updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateUserInformation = createServerFn({ method: "POST" })
	.inputValidator(
		(d: {
			id: string;
			name: string;
			password: string;
			confirmPassword: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsUserOrRole(data.id, "ADMIN");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		if (data.password !== data.confirmPassword) {
			throw new Error(t("The passwords entered do not match"));
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
			return { data: user, message: t("Settings updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createUser = createServerFn({ method: "POST" })
	.inputValidator((d: { userName: string; name: string; role: Role }) => d)
	.handler(async ({ data }) => {
		const isAuthenticated = await useIsRole("ADMIN");
		if (!isAuthenticated) {
			throw new Error(t("Unauthorized"));
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

			return { data: user, message: t("User created") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createUserFromInvitation = createServerFn({ method: "POST" })
	.inputValidator(
		(d: { invitationId: string; password: string; confirmPassword: string }) =>
			d,
	)
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
				throw new Error(t("Invitation not found"));
			}

			if (data.password !== data.confirmPassword) {
				throw new Error(t("The passwords entered do not match"));
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
			return { data: user, message: t("User created") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deleteUser = createServerFn({ method: "POST" })
	.inputValidator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
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
			return { message: t("User deleted") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updatePasswordFromReset = createServerFn({ method: "POST" })
	.inputValidator(
		(d: { resetId: string; password: string; confirmPassword: string }) => d,
	)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		try {
			const passwordReset = await prismaClient.passwordReset.findUnique({
				where: {
					id: data.resetId,
				},
			});
			if (!passwordReset) {
				throw new Error(t("Password reset request not found"));
			}

			if (data.password !== data.confirmPassword) {
				throw new Error(t("The passwords entered do not match"));
			}

			const hashedPassword = await hashPassword(data.password);
			const user = await prismaClient.user.update({
				data: {
					password: hashedPassword,
				},
				where: {
					id: passwordReset.userId,
				},
			});

			await prismaClient.passwordReset.delete({
				where: {
					id: data.resetId,
				},
			});

			await session.update(user);
			return { data: user, message: t("User updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getFeedConfig = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data?.id) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const user = await prismaClient.user.findUnique({
				select: { feedConfig: true, feedId: true },
				where: { id: session.data.id },
			});

			if (!user) {
				throw new Error(t("User not found"));
			}

			const config: FeedConfig = {
				includeAppointmentTypes: user.feedConfig?.includeAppointmentTypes
					? (user.feedConfig.includeAppointmentTypes.split(
							",",
						) as AppointmentType[])
					: undefined,
				includeDraftStatus: user.feedConfig?.includeDraftStatus ?? false,
				includeResponseTypes: user.feedConfig?.includeResponseTypes
					? (user.feedConfig.includeResponseTypes.split(",") as ResponseType[])
					: undefined,
			};

			return {
				data: { config, feedId: user.feedId },
				message: t("Feed config loaded"),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const updateFeedConfig = createServerFn({ method: "POST" })
	.inputValidator((d: FeedConfig) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data?.id) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const feedConfig = await prismaClient.feedConfig.upsert({
				create: {
					includeAppointmentTypes: data.includeAppointmentTypes?.join(","),
					includeDraftStatus: data.includeDraftStatus ?? false,
					includeResponseTypes: data.includeResponseTypes?.join(","),
					userId: session.data.id,
				},
				update: {
					includeAppointmentTypes: data.includeAppointmentTypes?.join(","),
					includeDraftStatus: data.includeDraftStatus ?? false,
					includeResponseTypes: data.includeResponseTypes?.join(","),
				},
				where: {
					userId: session.data.id,
				},
			});

			const user = await prismaClient.user.findUnique({
				select: { feedId: true },
				where: { id: session.data.id },
			});

			const config: FeedConfig = {
				includeAppointmentTypes: feedConfig.includeAppointmentTypes
					? (feedConfig.includeAppointmentTypes.split(",") as AppointmentType[])
					: undefined,
				includeDraftStatus: feedConfig.includeDraftStatus,
				includeResponseTypes: feedConfig.includeResponseTypes
					? (feedConfig.includeResponseTypes.split(",") as ResponseType[])
					: undefined,
			};

			return {
				data: { config, feedId: user?.feedId || "" },
				message: t("Feed settings updated"),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

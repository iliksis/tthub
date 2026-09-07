import { createServerFn } from "@tanstack/react-start";
import { hashPassword, prismaClient } from "@/lib/db";
import type { FeedConfig as FeedConfigRecord } from "@/lib/prisma/client";
import type { AppointmentType, ResponseType, Role } from "@/lib/prisma/enums";
import { useAppSession, useIsRole, useIsUserOrRole } from "@/lib/session";
import { m } from "@/paraglide/messages";

export interface FeedConfig {
	includeResponseTypes?: ResponseType[];
	includeDraftStatus?: boolean;
	includeAppointmentTypes?: AppointmentType[];
	excludeLabelIds?: string[];
}

function parseCommaList<T extends string>(
	value: string | null | undefined,
): T[] | undefined {
	return value ? (value.split(",") as T[]) : undefined;
}

function joinCommaList(value: string[] | undefined): string | undefined {
	return value?.join(",");
}

// Shared by getFeedConfig/updateFeedConfig here and the /feed/$feedId route,
// which all reconstruct the same FeedConfig shape from the same comma-joined
// FeedConfig DB columns.
export function parseFeedConfig(
	row:
		| Pick<
				FeedConfigRecord,
				| "excludeLabelIds"
				| "includeAppointmentTypes"
				| "includeDraftStatus"
				| "includeResponseTypes"
		  >
		| null
		| undefined,
): FeedConfig {
	return {
		excludeLabelIds: parseCommaList(row?.excludeLabelIds),
		includeAppointmentTypes: parseCommaList<AppointmentType>(
			row?.includeAppointmentTypes,
		),
		includeDraftStatus: row?.includeDraftStatus ?? false,
		includeResponseTypes: parseCommaList<ResponseType>(
			row?.includeResponseTypes,
		),
	};
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
	.validator((d: { id: string; role: Role }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		// biome-ignore lint/correctness/useHookAtTopLevel: not a real hook
		const session = await useAppSession();
		if (session.data?.id === data.id) {
			throw new Error(m.users_you_cannot_change_your_own_role());
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
			return { data: user, message: m.common_user_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateUserInformation = createServerFn({ method: "POST" })
	.validator(
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
			throw new Error(m.common_unauthorized());
		}

		if (data.password !== data.confirmPassword) {
			throw new Error(m.common_the_passwords_entered_do_not_match());
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
			return { data: user, message: m.common_settings_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createUser = createServerFn({ method: "POST" })
	.validator((d: { userName: string; name: string; role: Role }) => d)
	.handler(async ({ data }) => {
		const isAuthenticated = await useIsRole("ADMIN");
		if (!isAuthenticated) {
			throw new Error(m.common_unauthorized());
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

			return { data: user, message: m.users_user_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createUserFromInvitation = createServerFn({ method: "POST" })
	.validator(
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
				throw new Error(m.common_invitation_not_found());
			}

			if (data.password !== data.confirmPassword) {
				throw new Error(m.common_the_passwords_entered_do_not_match());
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
			return { data: user, message: m.users_user_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deleteUser = createServerFn({ method: "POST" })
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("ADMIN");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
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
			return { message: m.users_user_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updatePasswordFromReset = createServerFn({ method: "POST" })
	.validator(
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
				throw new Error(m.common_password_reset_request_not_found());
			}

			if (data.password !== data.confirmPassword) {
				throw new Error(m.common_the_passwords_entered_do_not_match());
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
			return { data: user, message: m.common_user_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getFeedConfig = createServerFn({ method: "GET" }).handler(
	async () => {
		const session = await useAppSession();
		if (!session.data?.id) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const user = await prismaClient.user.findUnique({
				select: { feedConfig: true, feedId: true },
				where: { id: session.data.id },
			});

			if (!user) {
				throw new Error(m.users_user_not_found());
			}

			return {
				data: {
					config: parseFeedConfig(user.feedConfig),
					feedId: user.feedId,
				},
				message: m.users_feed_config_loaded(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	},
);

export const updateFeedConfig = createServerFn({ method: "POST" })
	.validator((d: FeedConfig) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		if (!session.data?.id) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const feedConfigData = {
				excludeLabelIds: joinCommaList(data.excludeLabelIds),
				includeAppointmentTypes: joinCommaList(data.includeAppointmentTypes),
				includeDraftStatus: data.includeDraftStatus ?? false,
				includeResponseTypes: joinCommaList(data.includeResponseTypes),
			};
			const feedConfig = await prismaClient.feedConfig.upsert({
				create: { ...feedConfigData, userId: session.data.id },
				update: feedConfigData,
				where: { userId: session.data.id },
			});

			const user = await prismaClient.user.findUnique({
				select: { feedId: true },
				where: { id: session.data.id },
			});

			return {
				data: {
					config: parseFeedConfig(feedConfig),
					feedId: user?.feedId || "",
				},
				message: m.users_feed_settings_updated(),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

import { ClientOnly, useRouteContext, useRouter } from "@tanstack/react-router";
import { LinkIcon, Trash2Icon } from "lucide-react";
import { createUserInvitation } from "@/api/invitations";
import { deleteUser, updateUserRole } from "@/api/users";
import { CreateUserModal } from "@/components/modal/CreateUserModal";
import { notify } from "@/components/Toast";
import { useMutation } from "@/hooks/useMutation";
import type { User, UserInvitation } from "@/lib/prisma/client";
import { Role } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { isInvitationExpired } from "@/lib/utils";

type IUserManagementProps = {
	users: (User & { invitation: UserInvitation | null })[];
};
export const UserManagement = ({ users }: IUserManagementProps) => {
	const router = useRouter();
	const { user: currentUser } = useRouteContext({ from: "__root__" });

	const deleteMutation = useMutation({
		fn: deleteUser,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					status: "success",
					title: data.message,
				});
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	const onDelete = (user: User) => async () => {
		deleteMutation.mutate({
			data: {
				id: user.id,
			},
		});
	};

	const updateUserMutation = useMutation({
		fn: updateUserRole,
		onSuccess: async (ctx) => {
			if (ctx.data?.status < 400) {
				await router.invalidate();
				return;
			}
		},
	});

	const onUpdate =
		(user: User) => async (e: React.ChangeEvent<HTMLSelectElement>) => {
			updateUserMutation.mutate({
				data: {
					id: user.id,
					role: e.target.value as Role,
				},
			});
		};

	const createInvitationMutation = useMutation({
		fn: createUserInvitation,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					status: "success",
					title: data.message,
				});
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	const onCreateInvitation = (user: User) => async () => {
		createInvitationMutation.mutate({
			data: {
				userId: user.id,
			},
		});
	};

	return (
		<div className="overflow-x-auto">
			<table className="table">
				<thead>
					<tr>
						<th></th>
						<th>{t("Name")}</th>
						<th>{t("User Name")}</th>
						<th>{t("Role")}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user.id}>
							<td>
								<button
									type="button"
									className="btn btn-square btn-error btn-ghost"
									onClick={onDelete(user)}
									disabled={user.id === currentUser?.id}
								>
									<Trash2Icon className="size-4" />
								</button>
							</td>
							<td>{user.name}</td>
							<td>{user.userName}</td>
							<td>
								<select
									className="select select-primary"
									defaultValue={user.role}
									disabled={user.id === currentUser?.id}
									onChange={onUpdate(user)}
								>
									{Object.keys(Role).map((role) => (
										<option key={role} selected={user.role === role}>
											{role}
										</option>
									))}
								</select>
							</td>
							<td>
								<ClientOnly fallback={<div></div>}>
									{user.invitation ? (
										isInvitationExpired(user.invitation) ? (
											<button
												type="button"
												className="btn btn-warning tooltip tooltip-left"
												aria-label={t("Create new link")}
												data-tip={t("Create new link")}
												onClick={onCreateInvitation(user)}
											>
												{t("Expired")}
											</button>
										) : (
											<button
												type="button"
												className="btn btn-square btn-primary tooltip tooltip-left"
												aria-label={t("Copy link")}
												data-tip={t("Copy link")}
												onClick={() => {
													navigator.clipboard.writeText(
														`${window.location.origin}/invite/${user.invitation?.id}`,
													);
												}}
											>
												<LinkIcon className="size-4" />
											</button>
										)
									) : null}
								</ClientOnly>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="divider h-1"></div>
			<CreateUserModal />
		</div>
	);
};

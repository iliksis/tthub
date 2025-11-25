import { useRouteContext, useRouter } from "@tanstack/react-router";
import { LinkIcon, Trash2Icon } from "lucide-react";
import { createUserInvitation } from "@/api/invitations";
import { deleteUser, updateUser } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import type { User, UserInvitation } from "@/lib/prisma/client";
import { Role } from "@/lib/prisma/enums";
import { isInvitationExpired } from "@/lib/utils";
import { CreateUserModal } from "./CreateUserModal";
import { notify } from "./Toast";

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
					text: data.message,
					status: "success",
				});
				return;
			}
			notify({ text: data.message, status: "error" });
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
		fn: updateUser,
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
					name: user.name,
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
					text: data.message,
					status: "success",
				});
				return;
			}
			notify({ text: data.message, status: "error" });
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
						<th>Name</th>
						<th>User Name</th>
						<th>Role</th>
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
								{user.invitation ? (
									isInvitationExpired(user.invitation) ? (
										<button
											type="button"
											className="btn btn-warning tooltip tooltip-left"
											aria-label="Create new link"
											data-tip="Create new link"
											onClick={onCreateInvitation(user)}
										>
											Expired
										</button>
									) : (
										<button
											type="button"
											className="btn btn-square btn-primary tooltip tooltip-left"
											aria-label="Copy link"
											data-tip="Copy link"
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

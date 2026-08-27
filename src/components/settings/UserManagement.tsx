import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronsUpDownIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createUserInvitation } from "@/api/invitations";
import { createPasswordReset } from "@/api/passwordReset";
import { deleteUser, updateUserRole } from "@/api/users";
import { DetailsList } from "@/components/DetailsList";
import { CreateUserModal } from "@/components/modal/CreateUserModal";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "@/hooks/useMutation";
import type { PasswordReset, User, UserInvitation } from "@/lib/prisma/client";
import { Role } from "@/lib/prisma/enums";
import {
	cn,
	isInvitationExpired,
	roleBadgeVariant,
	roleLabel,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

type IUserManagementProps = {
	users: (User & {
		invitation: UserInvitation | null;
		passwordReset: PasswordReset | null;
	})[];
};
export const UserManagement = ({ users }: IUserManagementProps) => {
	const router = useRouter();
	const { user: currentUser } = useRouteContext({ from: "__root__" });

	const [showNewUserModal, setShowNewUserModal] = React.useState(false);

	const createPasswordResetServerFn = useServerFn(createPasswordReset);

	const deleteMutation = useMutation({
		fn: deleteUser,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const onDelete = (user: User) => async () => {
		deleteMutation.mutate({
			data: {
				id: user.id,
			},
		});
	};

	const createInvitationMutation = useMutation({
		fn: createUserInvitation,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const onCreateInvitation = (user: User) => async () => {
		createInvitationMutation.mutate({
			data: {
				userId: user.id,
			},
		});
	};

	const updateRoleMutation = useMutation({
		fn: updateUserRole,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	return (
		<div className="overflow-x-auto">
			<DetailsList
				items={users}
				getItemId={(item) => item.id}
				selectMode="single"
				columns={[
					{
						key: "name",
						label: m.common_name(),
						render: (item) => item.name,
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "userName",
						label: m.common_user_name(),
						render: (item) => item.userName,
					},
					{
						key: "role",
						label: m.users_role(),
						render: (item) => {
							const isSelf = item.id === currentUser?.id;
							return (
								<DropdownMenu>
									<DropdownMenuTrigger
										disabled={isSelf}
										render={
											<button
												type="button"
												title={
													isSelf
														? m.users_you_cannot_change_your_own_role()
														: undefined
												}
												className={cn(
													"group -mx-1.5 flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
													isSelf
														? "cursor-not-allowed opacity-60"
														: "hover:bg-muted",
												)}
											/>
										}
									>
										<Badge variant={roleBadgeVariant[item.role]}>
											{roleLabel(item.role)}
										</Badge>
										{!isSelf && (
											<ChevronsUpDownIcon className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
										)}
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<DropdownMenuRadioGroup
											value={item.role}
											onValueChange={(value) =>
												updateRoleMutation.mutate({
													data: { id: item.id, role: value as Role },
												})
											}
										>
											{Object.keys(Role).map((role) => (
												<DropdownMenuRadioItem key={role} value={role}>
													{roleLabel(role as Role)}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							);
						},
					},
					{
						key: "invitation",
						label: "",
						render: (item) => {
							if (!item.invitation) return null;

							return isInvitationExpired(item.invitation) ? (
								<span className="text-warning">
									{m.common_invitation_expired()}
								</span>
							) : (
								m.users_invitation_active()
							);
						},
					},
				]}
				commandBarItems={[
					{
						icon: <UserPlusIcon className="size-4" />,
						key: "create-user",
						label: m.users_create_user(),
						onClick: () => setShowNewUserModal(true),
						onlyIcon: true,
						variant: "primary",
					},
					{
						isDisabled: (items) =>
							items.length !== 1 ||
							items[0].id === currentUser?.id ||
							items[0].invitation !== null,
						key: "password-reset",
						label: m.users_reset_password(),
						onClick: async (items) => {
							try {
								const response = await createPasswordResetServerFn({
									data: { userId: items[0].id },
								});
								await navigator.clipboard.writeText(
									`${window.location.origin}/password-reset/${response.data.id}`,
								);
								toast.success(m.users_password_reset_created());
							} catch (err) {
								toast.error((err as Error).message);
							}
						},
						variant: "secondary",
					},
					{
						isDisabled: (items) =>
							items.length !== 1 ||
							items[0].invitation === null ||
							!isInvitationExpired(items[0].invitation),
						key: "create-invitation",
						label: m.users_create_new_invitation(),
						onClick: (items) => onCreateInvitation(items[0])(),
						variant: "secondary",
					},
					{
						dropdown: {
							items: [
								{
									isDisabled: (items) =>
										items.length !== 1 || items[0].invitation == null,
									key: "copy-invitation-link",
									label: m.users_copy_invitation_link(),
									onClick: async (items) => {
										await navigator.clipboard.writeText(
											`${window.location.origin}/invite/${items[0].invitation?.id}`,
										);
										toast.success(
											m.users_invitation_link_copied_to_clipboard(),
										);
									},
								},
								{
									isDisabled: (items) =>
										items.length !== 1 || items[0].passwordReset == null,
									key: "copy-reset-link",
									label: m.users_copy_password_reset_link(),
									onClick: async (items) => {
										await navigator.clipboard.writeText(
											`${window.location.origin}/password-reset/${items[0].passwordReset?.id}`,
										);
										toast.success(
											m.users_password_reset_link_copied_to_clipboard(),
										);
									},
								},
							],
						},
						isDisabled: (items) => items.length !== 1,
						key: "copy-links",
						label: m.users_copy_links(),
						variant: "secondary",
					},
					{
						icon: <Trash2Icon className="size-4" />,
						isDisabled: (items) =>
							items.length !== 1 || items[0].id === currentUser?.id,
						key: "delete",
						label: m.common_delete(),
						onClick: (items) => onDelete(items[0])(),
						onlyIcon: true,
						variant: "error",
					},
				]}
			/>
			<CreateUserModal
				modalOpen={showNewUserModal}
				onClose={() => setShowNewUserModal(false)}
			/>
		</div>
	);
};

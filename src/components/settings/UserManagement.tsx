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
import { t } from "@/lib/text";
import { cn, isInvitationExpired } from "@/lib/utils";

const roleBadgeVariant: Record<Role, "outline" | "info" | "success"> = {
	ADMIN: "success",
	EDITOR: "info",
	USER: "outline",
};

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
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
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
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
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
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
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
						label: t("Name"),
						render: (item) => item.name,
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "userName",
						label: t("User Name"),
						render: (item) => item.userName,
					},
					{
						key: "role",
						label: t("Role"),
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
														? t("You cannot change your own role")
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
											{item.role}
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
													{role}
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
								<span className="text-warning">{t("Invitation expired")}</span>
							) : (
								t("Invitation Active")
							);
						},
					},
				]}
				commandBarItems={[
					{
						icon: <UserPlusIcon className="size-4" />,
						key: "create-user",
						label: t("Create User"),
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
						label: t("Reset Password"),
						onClick: async (items) => {
							const response = await createPasswordResetServerFn({
								data: { userId: items[0].id },
							});
							const data = await response.json();
							if (response.status < 400 && data.data) {
								await navigator.clipboard.writeText(
									`${window.location.origin}/password-reset/${data.data.id}`,
								);
								toast.success(t("Password reset created"));
							} else {
								toast.error(data.message);
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
						label: t("Create new Invitation"),
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
									label: t("Copy Invitation Link"),
									onClick: async (items) => {
										await navigator.clipboard.writeText(
											`${window.location.origin}/invite/${items[0].invitation?.id}`,
										);
										toast.success(t("Invitation link copied to clipboard"));
									},
								},
								{
									isDisabled: (items) =>
										items.length !== 1 || items[0].passwordReset == null,
									key: "copy-reset-link",
									label: t("Copy Password Reset Link"),
									onClick: async (items) => {
										await navigator.clipboard.writeText(
											`${window.location.origin}/password-reset/${items[0].passwordReset?.id}`,
										);
										toast.success(t("Password reset link copied to clipboard"));
									},
								},
							],
						},
						isDisabled: (items) => items.length !== 1,
						key: "copy-links",
						label: t("Copy Links"),
						variant: "secondary",
					},
					{
						icon: <Trash2Icon className="size-4" />,
						isDisabled: (items) =>
							items.length !== 1 || items[0].id === currentUser?.id,
						key: "delete",
						label: t("Delete"),
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

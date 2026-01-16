import { useForm } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { LinkIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import React from "react";
import { createUserInvitation } from "@/api/invitations";
import { deleteUser, updateUserRole } from "@/api/users";
import { DetailsList } from "@/components/DetailsList";
import { CreateUserModal } from "@/components/modal/CreateUserModal";
import { notify } from "@/components/Toast";
import { useMutation } from "@/hooks/useMutation";
import type { User, UserInvitation } from "@/lib/prisma/client";
import { Role } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { isInvitationExpired } from "@/lib/utils";
import { Modal } from "../modal/Modal";

type IUserManagementProps = {
	users: (User & { invitation: UserInvitation | null })[];
};
export const UserManagement = ({ users }: IUserManagementProps) => {
	const router = useRouter();
	const { user: currentUser } = useRouteContext({ from: "__root__" });

	const [showRoleUpdateModal, setShowRoleUpdateModal] = React.useState<
		User | undefined
	>(undefined);
	const [showNewUserModal, setShowNewUserModal] = React.useState(false);

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
			<DetailsList
				items={users}
				getItemId={(item) => item.id}
				selectMode="single"
				columns={[
					{ key: "name", label: t("Name"), render: (item) => item.name },
					{
						key: "userName",
						label: t("User Name"),
						render: (item) => item.userName,
					},
					{ key: "role", label: t("Role"), render: (item) => item.role },
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
							items.length !== 1 || items[0].id === currentUser?.id,
						key: "update-role",
						label: t("Update Role"),
						onClick: (items) => {
							setShowRoleUpdateModal(items[0]);
						},
						variant: "secondary",
					},
					{
						isDisabled: (items) =>
							items.length !== 1 || items[0].id === currentUser?.id,
						key: "password-reset",
						label: t("Reset Password"),
						onClick: (items) => {},
						variant: "secondary",
					},
					{
						isDisabled: (items) =>
							items.length !== 1 ||
							items[0].invitation === null ||
							!isInvitationExpired(items[0].invitation),
						key: "create-invitation",
						label: t("Create Invitation"),
						onClick: (items) => onCreateInvitation(items[0])(),
						variant: "secondary",
					},
					{
						icon: <LinkIcon className="size-4" />,
						isDisabled: (items) =>
							items.length !== 1 || items[0].invitation == null,
						key: "copy-invitation-link",
						label: t("Copy Invitation Link"),
						onClick: async (items) => {
							await navigator.clipboard.writeText(
								`${window.location.origin}/invite/${items[0].invitation?.id}`,
							);
							notify({
								status: "success",
								title: t("Invitation link copied to clipboard"),
							});
						},
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
			<div className="divider h-1"></div>
			<CreateUserModal
				modalOpen={showNewUserModal}
				onClose={() => setShowNewUserModal(false)}
			/>
			{showRoleUpdateModal && (
				<UpdateRoleModal
					onClose={() => setShowRoleUpdateModal(undefined)}
					user={showRoleUpdateModal}
				/>
			)}
		</div>
	);
};

type UpdateRoleModalProps = {
	onClose: () => void;
	user: User;
};
export const UpdateRoleModal = ({ onClose, user }: UpdateRoleModalProps) => {
	const router = useRouter();

	const updateUserMutation = useMutation({
		fn: updateUserRole,
		onSuccess: async (ctx) => {
			if (ctx.data?.status < 400) {
				await router.invalidate();
				onClose();
				return;
			}
		},
	});

	const form = useForm({
		defaultValues: {
			role: user.role,
		},
		onSubmit: async ({ value }) => {
			updateUserMutation.mutate({
				data: {
					id: user.id,
					role: value.role,
				},
			});
		},
	});

	return (
		<Modal
			className="modal-bottom"
			modalBoxClassName="md:max-w-xl md:mx-auto"
			open={true}
			onClose={onClose}
			onRenderActionButton={() => (
				<button
					type="submit"
					className="btn btn-primary"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{t("Update")}
				</button>
			)}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="role">
						{(field) => {
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Role")}:
									</label>
									<select
										className="select select-primary w-full"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value as Role)}
										id={field.name}
										onBlur={field.handleBlur}
									>
										{Object.keys(Role).map((role) => (
											<option key={role}>{role}</option>
										))}
									</select>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
			</form>
		</Modal>
	);
};

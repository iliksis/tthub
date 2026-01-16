import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { createUser } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { Role } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { notify } from "../Toast";
import { Modal } from "./Modal";

type NewUser = {
	userName: string;
	name: string;
	role: Role;
};
const defaultUser: NewUser = {
	name: "",
	role: Role.USER,
	userName: "",
};

type CreateUserModalProps = {
	modalOpen: boolean;
	onClose: () => void;
};
export const CreateUserModal = ({
	modalOpen,
	onClose,
}: CreateUserModalProps) => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createUser,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				form.reset();
				await router.invalidate();
				notify({ status: "success", title: data.message });
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	const form = useForm({
		defaultValues: defaultUser,
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					name: value.name,
					role: value.role,
					userName: value.userName,
				},
			});
		},
	});

	return (
		<Modal
			className="modal-bottom"
			modalBoxClassName="md:max-w-xl md:mx-auto"
			open={modalOpen}
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
					{t("Create")}
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
					<form.Field name="name">
						{(field) => {
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Name")}:
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
				</div>
				<div>
					<form.Field name="userName">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("User Name")}:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field name="role">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Role")}:
								</label>
								<select
									id={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value as Role)}
									className="select select-primary w-full"
									value={field.state.value}
								>
									{Object.keys(Role).map((role) => (
										<option key={role}>{role}</option>
									))}
								</select>
							</fieldset>
						)}
					</form.Field>
				</div>
			</form>
		</Modal>
	);
};

import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { UserPlusIcon } from "lucide-react";
import { createUser } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { Role } from "@/lib/prisma/enums";
import { Modal } from "./Modal";
import { notify } from "./Toast";

type NewUser = {
	userName: string;
	name: string;
	role: Role;
};
const defaultUser: NewUser = {
	userName: "",
	name: "",
	role: Role.USER,
};

export const CreateUserModal = () => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createUser,
		onSuccess: async (ctx) => {
			if (!ctx.data?.error) {
				form.reset();
				await router.invalidate();
				notify({ text: "User created", status: "success" });
				return;
			}
			notify({ text: "User creation failed", status: "error" });
		},
	});

	const form = useForm({
		defaultValues: defaultUser,
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					userName: value.userName,
					name: value.name,
					role: value.role,
				},
			});
		},
	});

	return (
		<Modal
			openButtonText="Create a new User"
			openButtonIcon={<UserPlusIcon className="size-4" />}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					{/* A type-safe field component*/}
					<form.Field name="name">
						{(field) => {
							// Avoid hasty abstractions. Render props are great!
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										Name:
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
									User Name:
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
									Role:
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
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<button
							type="submit"
							className="btn btn-primary mt-4"
							disabled={!canSubmit}
						>
							{isSubmitting ? "..." : "Submit"}
						</button>
					)}
				</form.Subscribe>
			</form>
		</Modal>
	);
};

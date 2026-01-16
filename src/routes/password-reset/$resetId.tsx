import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getPasswordReset } from "@/api/passwordReset";
import { updatePasswordFromReset } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";

export const Route = createFileRoute("/password-reset/$resetId")({
	beforeLoad: async ({ params }) => {
		const passwordReset = await getPasswordReset({
			data: { id: params.resetId },
		});
		if (passwordReset === null) {
			throw new Error(t("Password reset request not found"));
		}
		return { passwordReset };
	},
	component: RouteComponent,
	errorComponent: ({ error }) => {
		return <div>{error.message}</div>;
	},
	loader: async ({ context }) => ({ passwordReset: context.passwordReset }),
});

function RouteComponent() {
	const params = Route.useParams();
	const { passwordReset } = Route.useLoaderData();
	const router = useRouter();

	const createMutation = useMutation({
		fn: updatePasswordFromReset,
		onSuccess: async (ctx) => {
			if (ctx.data.status < 400) {
				await router.invalidate();
				await router.navigate({ to: "/" });
				return;
			}
		},
	});

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					confirmPassword: value.confirmPassword,
					password: value.password,
					resetId: params.resetId,
				},
			});
		},
		validators: {
			onChange: ({ value }) => {
				if (value.password.length > 0 && value.confirmPassword.length === 0) {
					return true;
				}
				if (value.password.length === 0 && value.confirmPassword.length > 0) {
					return true;
				}
				if (value.password !== value.confirmPassword) {
					return t("The passwords entered do not match");
				}
			},
		},
	});

	const formErrorMap = useStore(form.store, (state) => state.errorMap);

	return (
		<div className="w-dvw h-dvh relative">
			<form
				className="card w-full max-w-sm bg-base-300 shrink-0 shadow-2xl absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="card-body">
					<h2 className="card-title">{t("Update your password")}</h2>
					<fieldset className="fieldset">
						<label className="label" htmlFor="username">
							{t("User Name")}:
						</label>
						<input
							id="username"
							className="input input-primary w-full"
							name="UserName"
							disabled={true}
							value={passwordReset.user.userName}
						/>
					</fieldset>
					<form.Field name="password">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Password")}:
								</label>
								<input
									id={field.name}
									type="password"
									className="input input-primary w-full"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</fieldset>
						)}
					</form.Field>
					<form.Field name="confirmPassword">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Confirm Password")}:
								</label>
								<input
									id={field.name}
									type="password"
									className="input input-primary w-full"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</fieldset>
						)}
					</form.Field>
					{formErrorMap.onChange && (
						<div className="text-error text-xs">{formErrorMap.onChange}</div>
					)}
					<form.Subscribe
						selector={(state) => [
							state.canSubmit,
							state.isSubmitting,
							state.isDefaultValue,
						]}
					>
						{([canSubmit, isSubmitting, isDefaultValue]) => (
							<button
								type="submit"
								className="btn btn-primary mt-4"
								disabled={!canSubmit || isDefaultValue}
							>
								{isSubmitting ? "..." : t("Update password")}
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

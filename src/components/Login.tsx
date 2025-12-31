import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { loginFn } from "@/routes/_authed";

export function Login() {
	const router = useRouter();

	const loginMutation = useMutation({
		fn: loginFn,
		onSuccess: async (ctx) => {
			if (!ctx.data?.error) {
				await router.invalidate();
				return;
			}
		},
	});

	const form = useForm({
		defaultValues: {
			password: "",
			userName: "",
		},
		onSubmit: async ({ value }) => {
			loginMutation.mutate({
				data: {
					password: value.password,
					userName: value.userName,
				},
			});
		},
	});

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
				<div className="card-body gap-2">
					<form.Field name="userName">
						{(field) => {
							return (
								<fieldset className="fieldset">
									{/* register your input into the hook by invoking the "register" function */}
									<label className="label" htmlFor={field.name}>
										{t("User Name")}
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										placeholder={t("User Name")}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
					<form.Field name="password">
						{(field) => {
							return (
								<fieldset className="fieldset">
									{/* register your input into the hook by invoking the "register" function */}
									<label className="label" htmlFor={field.name}>
										{t("Password")}
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										type="password"
										placeholder={t("Password")}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
					{loginMutation.data?.error && (
						<div className="alert alert-error alert-soft">
							{loginMutation.data.message}
						</div>
					)}
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<button
								type="submit"
								className="btn btn-primary mt-2"
								disabled={!canSubmit}
							>
								{isSubmitting ? "..." : t("Login")}
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

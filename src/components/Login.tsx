import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useMutation } from "@/hooks/useMutation";
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
			userName: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			loginMutation.mutate({
				data: {
					userName: value.userName,
					password: value.password,
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
				<div className="card-body">
					<form.Field name="userName">
						{(field) => {
							return (
								<fieldset className="fieldset">
									{/* register your input into the hook by invoking the "register" function */}
									<label className="label" htmlFor={field.name}>
										User Name
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										placeholder="User Name"
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
										Password
									</label>
									<input
										id={field.name}
										className="input input-primary w-full"
										type="password"
										placeholder="Password"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							);
						}}
					</form.Field>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<button
								type="submit"
								className="btn btn-primary mt-4"
								disabled={!canSubmit}
							>
								{isSubmitting ? "..." : "Login"}
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

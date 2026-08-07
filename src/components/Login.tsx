import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
					userName: value.userName.trim(),
				},
			});
		},
	});

	return (
		<div className="w-dvw h-dvh relative">
			<form
				className="w-full max-w-sm shrink-0 rounded-xl bg-card text-card-foreground shadow-2xl absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-col gap-3 p-6">
					<form.Field name="userName">
						{(field) => {
							return (
								<fieldset className="flex flex-col gap-1.5">
									{/* register your input into the hook by invoking the "register" function */}
									<Label htmlFor={field.name}>{t("User Name")}</Label>
									<Input
										id={field.name}
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
								<fieldset className="flex flex-col gap-1.5">
									{/* register your input into the hook by invoking the "register" function */}
									<Label htmlFor={field.name}>{t("Password")}</Label>
									<Input
										id={field.name}
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
						<Alert variant="destructive">
							<AlertDescription>{loginMutation.data.message}</AlertDescription>
						</Alert>
					)}
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button type="submit" className="mt-2" disabled={!canSubmit}>
								{isSubmitting ? "..." : t("Login")}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

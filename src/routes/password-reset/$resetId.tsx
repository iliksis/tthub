import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getPasswordReset } from "@/api/passwordReset";
import { updatePasswordFromReset } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
		onSuccess: async () => {
			await router.invalidate();
			await router.navigate({ to: "/" });
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
			<Card className="w-full max-w-sm shrink-0 shadow-2xl absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2">
				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<CardContent className="flex flex-col gap-2">
						<h2 className="text-lg font-semibold leading-none">
							{t("Update your password")}
						</h2>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="username">{t("User Name")}:</Label>
							<Input
								id="username"
								name="UserName"
								disabled={true}
								value={passwordReset.user.userName}
							/>
						</fieldset>
						<form.Field name="password">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Password")}:</Label>
									<Input
										id={field.name}
										type="password"
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
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Confirm Password")}:</Label>
									<Input
										id={field.name}
										type="password"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
						{formErrorMap.onChange && (
							<div className="text-destructive text-xs">
								{formErrorMap.onChange}
							</div>
						)}
						<form.Subscribe
							selector={(state) => [
								state.canSubmit,
								state.isSubmitting,
								state.isDefaultValue,
							]}
						>
							{([canSubmit, isSubmitting, isDefaultValue]) => (
								<Button
									type="submit"
									className="mt-4"
									disabled={!canSubmit || isDefaultValue}
								>
									{isSubmitting ? t("Loading…") : t("Update password")}
								</Button>
							)}
						</form.Subscribe>
					</CardContent>
				</form>
			</Card>
		</div>
	);
}

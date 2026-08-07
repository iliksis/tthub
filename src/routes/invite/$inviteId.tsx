import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getInvitation } from "@/api/invitations";
import { createUserFromInvitation } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { isInvitationExpired } from "@/lib/utils";

export const Route = createFileRoute("/invite/$inviteId")({
	beforeLoad: async ({ params }) => {
		const invitation = await getInvitation({ data: { id: params.inviteId } });
		if (invitation === null) {
			throw new Error(t("Invitation not found"));
		}
		if (isInvitationExpired(invitation)) {
			throw new Error(t("Invitation expired"));
		}
		return { invitation };
	},
	component: RouteComponent,
	errorComponent: ({ error }) => {
		if (error.message === "Not found") {
			return <div>{t("Invitation not found")}</div>;
		}
		if (error.message === "Invitation expired") {
			return <div>{t("Invitation expired")}</div>;
		}
		throw error;
	},
	loader: async ({ context }) => ({ invitation: context.invitation }),
});

function RouteComponent() {
	const params = Route.useParams();
	const { invitation } = Route.useLoaderData();
	const router = useRouter();

	const createMutation = useMutation({
		fn: createUserFromInvitation,
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
					invitationId: params.inviteId,
					password: value.password,
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
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<CardContent className="flex flex-col gap-2">
						<h2 className="text-lg font-semibold leading-none">
							{t("Set a password to create your Account")}
						</h2>
						<fieldset className="flex flex-col gap-1.5">
							<Label htmlFor="username">{t("User Name")}:</Label>
							<Input
								id="username"
								name="UserName"
								disabled={true}
								value={invitation.user.userName}
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
									{isSubmitting ? t("Loading…") : t("Create Account")}
								</Button>
							)}
						</form.Subscribe>
					</CardContent>
				</form>
			</Card>
		</div>
	);
}

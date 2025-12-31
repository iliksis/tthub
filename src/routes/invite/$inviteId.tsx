import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getInvitation } from "@/api/invitations";
import { createUserFromInvitation } from "@/api/users";
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
			password: "",
		},
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					invitationId: params.inviteId,
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
					<h2 className="card-title">
						{t("Set a password to create your Account")}
					</h2>
					<fieldset className="fieldset">
						<label className="label" htmlFor="username">
							{t("User Name")}:
						</label>
						<input
							id="username"
							className="input input-primary w-full"
							name="UserName"
							disabled={true}
							value={invitation.user.userName}
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
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<button
								type="submit"
								className="btn btn-primary mt-4"
								disabled={!canSubmit}
							>
								{isSubmitting ? "..." : "Create Account"}
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { getInvitation } from "@/api/invitations";
import { createUserFromInvitation } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { isInvitationExpired } from "@/lib/utils";

export const Route = createFileRoute("/invite/$inviteId")({
	component: RouteComponent,
	beforeLoad: async ({ params }) => {
		const invitation = await getInvitation({ data: { id: params.inviteId } });
		if (invitation === null) {
			throw new Error("Not found");
		}
		if (isInvitationExpired(invitation)) {
			throw new Error("Invitation expired");
		}
	},
	errorComponent: ({ error }) => {
		if (error.message === "Not found") {
			return <div>Invitation not found.</div>;
		}
		if (error.message === "Invitation expired") {
			return <div>Invitation has expired.</div>;
		}
		throw error;
	},
});

function RouteComponent() {
	const router = useRouter();
	const params = Route.useParams();

	const createMutation = useMutation({
		fn: createUserFromInvitation,
		onSuccess: async (ctx) => {
			if (!ctx.data.error) {
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
					<h2 className="card-title">Set a password to create your Account</h2>
					{/* A type-safe field component*/}
					<form.Field name="password">
						{(field) => {
							// Avoid hasty abstractions. Render props are great!
							return (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										Password:
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
								{isSubmitting ? "..." : "Create Account"}
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}

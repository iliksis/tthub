import { useForm } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { updateUserInformation } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { useAppSession } from "@/lib/session";
import { t } from "@/lib/text";
import { notify } from "./Toast";

const updateSession = createServerFn({ method: "POST" })
	.inputValidator((d: { name: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		await session.update({ ...session.data, name: data.name });
	});

export const Profile = () => {
	const router = useRouter();
	const { user: currentUser } = useRouteContext({
		from: "__root__",
	});

	const updateMutation = useMutation({
		fn: updateUserInformation,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				data.data?.name &&
					(await updateSession({ data: { name: data.data.name } }));
				notify({ text: data.message, status: "success" });
				return;
			}
			notify({ text: data.message, status: "error" });
		},
	});

	const form = useForm({
		defaultValues: {
			name: currentUser?.name || "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			updateMutation.mutate({
				data: {
					id: currentUser?.id || "empty",
					name: value.name,
					password: value.password,
				},
			});
		},
	});

	return (
		<div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="name">
						{(field) => (
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
						)}
					</form.Field>
				</div>
				<div>
					<form.Field name="password">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Password")}:
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
				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
				>
					{([canSubmit, isSubmitting]) => (
						<button
							type="submit"
							className="btn btn-primary mt-4"
							disabled={!canSubmit}
						>
							{isSubmitting ? "..." : t("Update")}
						</button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

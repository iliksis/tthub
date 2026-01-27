import { useForm, useStore } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateUserInformation } from "@/api/users";
import { useMutation } from "@/hooks/useMutation";
import { useAppSession } from "@/lib/session";
import { t } from "@/lib/text";

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
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			name: currentUser?.name || "",
			password: "",
		},
		onSubmit: async ({ value, formApi }) => {
			await updateMutation.mutate({
				data: {
					confirmPassword: value.confirmPassword,
					id: currentUser?.id || "empty",
					name: value.name,
					password: value.password,
				},
			});
			formApi.reset();
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
									type="password"
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
					<form.Field name="confirmPassword">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Confirm Password")}:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									type="password"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</fieldset>
						)}
					</form.Field>
				</div>
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
							className="btn btn-primary mt-4 w-36"
							disabled={!canSubmit || isDefaultValue}
						>
							{isSubmitting ? "..." : t("Update")}
						</button>
					)}
				</form.Subscribe>
			</form>
		</div>
	);
};

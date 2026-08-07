import { useForm, useStore } from "@tanstack/react-form";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateUserInformation } from "@/api/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { Role } from "@/lib/prisma/enums";
import { useAppSession } from "@/lib/session";
import { t } from "@/lib/text";

const updateSession = createServerFn({ method: "POST" })
	.inputValidator((d: { name: string }) => d)
	.handler(async ({ data }) => {
		const session = await useAppSession();
		await session.update({ ...session.data, name: data.name });
	});

const roleLabel = (role: Role) => {
	switch (role) {
		case "ADMIN":
			return t("Administrator");
		case "EDITOR":
			return t("Editor");
		default:
			return t("User");
	}
};

const roleBadgeVariant = (role: Role) => {
	switch (role) {
		case "ADMIN":
			return "success" as const;
		case "EDITOR":
			return "info" as const;
		default:
			return "outline" as const;
	}
};

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
		<div className="flex flex-col gap-8">
			<div className="flex flex-col items-center gap-1 sm:items-start">
				<h1 className="font-bold text-2xl">{currentUser?.name}</h1>
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<span>{currentUser?.userName}</span>
					{currentUser?.role && (
						<Badge variant={roleBadgeVariant(currentUser.role)}>
							{roleLabel(currentUser.role)}
						</Badge>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-5">
				<div className="flex flex-col gap-1">
					<h2 className="font-semibold text-lg">{t("Profile & Security")}</h2>
					<p className="text-muted-foreground text-sm">
						{t("Update your name or set a new password.")}
					</p>
				</div>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="name">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Name")}:</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</fieldset>
						)}
					</form.Field>
					<div className="grid gap-5 sm:grid-cols-2">
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
					</div>
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
								className="w-36"
								disabled={!canSubmit || isDefaultValue}
							>
								{isSubmitting ? "..." : t("Update")}
							</Button>
						)}
					</form.Subscribe>
				</form>
			</div>
		</div>
	);
};

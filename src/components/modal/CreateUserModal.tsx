import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { createUser } from "@/api/users";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@/hooks/useMutation";
import { Role } from "@/lib/prisma/enums";
import { t } from "@/lib/text";

type NewUser = {
	userName: string;
	name: string;
	role: Role;
};
const defaultUser: NewUser = {
	name: "",
	role: Role.USER,
	userName: "",
};

type CreateUserModalProps = {
	modalOpen: boolean;
	onClose: () => void;
};
export const CreateUserModal = ({
	modalOpen,
	onClose,
}: CreateUserModalProps) => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createUser,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				form.reset();
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: defaultUser,
		onSubmit: async ({ value }) => {
			createMutation.mutate({
				data: {
					name: value.name,
					role: value.role,
					userName: value.userName,
				},
			});
		},
	});

	return (
		<Dialog
			open={modalOpen}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogTitle className="sr-only">{t("Dialog")}</DialogTitle>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div>
						<form.Field name="name">
							{(field) => {
								return (
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
								);
							}}
						</form.Field>
					</div>
					<div>
						<form.Field name="userName">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("User Name")}:</Label>
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
					</div>
					<div>
						<form.Field name="role">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Role")}:</Label>
									<Select
										value={field.state.value}
										onValueChange={(value) => field.handleChange(value as Role)}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Object.keys(Role).map((role) => (
												<SelectItem key={role} value={role}>
													{role}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							)}
						</form.Field>
					</div>
				</form>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<Button
						type="submit"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{t("Create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

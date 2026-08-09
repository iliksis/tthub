import { useForm } from "@tanstack/react-form";
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
import { t } from "@/lib/text";

type TeamFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: {
		title: string;
		league: string;
		clickTTGroupId: string;
	};
	onSubmit: (updates: {
		title: string;
		league: string;
		clickTTGroupId: string;
	}) => Promise<void>;
};

export const TeamForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = { clickTTGroupId: "", league: "", title: "" },
	onSubmit,
}: TeamFormProps) => {
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			await onSubmit({ ...value });
		},
	});

	return (
		<Dialog
			open={open ?? false}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.();
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
						<form.Field name="title">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Title")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										minLength={2}
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
						<form.Field name="league">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("League")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										minLength={2}
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
						<form.Field name="clickTTGroupId">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("click-TT Group Id")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
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
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

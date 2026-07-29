import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/text";
import { Modal } from "../modal/Modal";

type TeamFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: {
		title: string;
		league: string;
	};
	onSubmit: (updates: { title: string; league: string }) => Promise<void>;
};

export const TeamForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = { league: "", title: "" },
	onSubmit,
}: TeamFormProps) => {
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			await onSubmit({ ...value });
		},
	});

	const onRenderActionButton = () => {
		return (
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
		);
	};

	return (
		<Modal
			open={open}
			modalBoxClassName="md:max-w-xl md:mx-auto"
			onClose={onClose}
			onRenderActionButton={onRenderActionButton}
		>
			<form
				className="flex flex-col gap-2"
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
			</form>
		</Modal>
	);
};

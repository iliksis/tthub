import { useForm } from "@tanstack/react-form";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
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
			<button
				type="submit"
				className="btn btn-primary"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				{submitLabel}
			</button>
		);
	};

	return (
		<Modal
			open={open}
			className="modal-bottom"
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
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Title")}:
								</label>
								<input
									id={field.name}
									className={cn(
										"input w-full",
										!field.state.meta.isValid ? "input-error" : "input-primary",
									)}
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
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("League")}:
								</label>
								<input
									id={field.name}
									className={cn(
										"input w-full",
										!field.state.meta.isValid ? "input-error" : "input-primary",
									)}
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

import { useForm } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Modal } from "../modal/Modal";

type PlayerFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: {
		name: string;
		year: number;
		qttr: number;
	};
	onSubmit: (updates: {
		name: string;
		year: number;
		qttr: number;
	}) => Promise<void>;
};
export const PlayerForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = { name: "", year: new Date().getFullYear(), qttr: 0 },
	onSubmit,
}: PlayerFormProps) => {
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
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }) =>
								value.length <= 1
									? "Name must have more than 1 character"
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									Name:
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
								{!field.state.meta.isValid && (
									<div className="text-error">
										{field.state.meta.errors.join(", ")}
									</div>
								)}
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field
						name="year"
						validators={{
							onChange: ({ value }) =>
								!Number.isInteger(value)
									? "Year of birth must be set"
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									Year of birth:
								</label>
								<input
									id={field.name}
									className={cn(
										"input w-full",
										!field.state.meta.isValid ? "input-error" : "input-primary",
									)}
									type="number"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(parseInt(e.target.value, 10))
									}
								/>
								{!field.state.meta.isValid && (
									<div className="text-error">
										{field.state.meta.errors.join(", ")}
									</div>
								)}
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field
						name="qttr"
						validators={{
							onChange: ({ value }) =>
								!Number.isInteger(value)
									? "QTTR must be set (0 is allowed)"
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									qttr:
								</label>
								<input
									id={field.name}
									className={cn(
										"input w-full",
										!field.state.meta.isValid ? "input-error" : "input-primary",
									)}
									type="number"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(parseInt(e.target.value, 10))
									}
								/>
								{!field.state.meta.isValid && (
									<div className="text-error">
										{field.state.meta.errors.join(", ")}
									</div>
								)}
							</fieldset>
						)}
					</form.Field>
				</div>
			</form>
		</Modal>
	);
};

import { useForm } from "@tanstack/react-form";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Modal } from "../modal/Modal";

type PlayerFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	teams?: Team[];
	defaultValues?: {
		name: string;
		year: number;
		qttr: number;
		team: string | null;
	};
	onSubmit: (updates: {
		name: string;
		year: number;
		qttr: number;
		team: string | null;
	}) => Promise<void>;
};
export const PlayerForm = ({
	open,
	onClose,
	submitLabel,
	teams,
	defaultValues = {
		name: "",
		qttr: 0,
		team: null,
		year: new Date().getFullYear(),
	},
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
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }) =>
								value.length <= 1
									? t("Name must be at least 2 characters long")
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Name")}:
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
									? t("Year of birth must be set")
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Year of birth")}:
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
									? t("QTTR must be set (0 is allowed)")
									: undefined,
						}}
					>
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("QTTR")}:
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
				{teams && (
					<div>
						<form.Field name="team">
							{(field) => (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Team")}:
									</label>
									<select
										className="select select-primary w-full"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									>
										<option disabled selected>
											{t("Choose a team")}
										</option>
										{teams.map((p) => (
											<option key={p.id} value={p.id}>
												{p.title}
											</option>
										))}
									</select>
								</fieldset>
							)}
						</form.Field>
					</div>
				)}
			</form>
		</Modal>
	);
};

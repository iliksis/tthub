import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
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
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Name")}:</Label>
								<Input
									id={field.name}
									aria-invalid={!field.state.meta.isValid}
									minLength={2}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{!field.state.meta.isValid && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors.join(", ")}
									</p>
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
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Year of birth")}:</Label>
								<Input
									id={field.name}
									aria-invalid={!field.state.meta.isValid}
									type="number"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(parseInt(e.target.value, 10))
									}
								/>
								{!field.state.meta.isValid && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors.join(", ")}
									</p>
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
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("QTTR")}:</Label>
								<Input
									id={field.name}
									aria-invalid={!field.state.meta.isValid}
									type="number"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(parseInt(e.target.value, 10))
									}
								/>
								{!field.state.meta.isValid && (
									<p className="text-sm text-destructive">
										{field.state.meta.errors.join(", ")}
									</p>
								)}
							</fieldset>
						)}
					</form.Field>
				</div>
				{teams && (
					<div>
						<form.Field name="team">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Team")}:</Label>
									<Select
										name={field.name}
										value={field.state.value ?? undefined}
										onValueChange={(value) => field.handleChange(value)}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue placeholder={t("Choose a team")} />
										</SelectTrigger>
										<SelectContent>
											{teams.map((p) => (
												<SelectItem key={p.id} value={p.id}>
													{p.title}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							)}
						</form.Field>
					</div>
				)}
			</form>
		</Modal>
	);
};

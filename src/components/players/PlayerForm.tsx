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
	defaultValues = {
		name: "",
		qttr: 0,
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

	return (
		<Dialog
			open={open ?? false}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.();
			}}
		>
			<DialogContent>
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

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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Gender } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";

const genderOptions: { label: string; value: Gender | null }[] = [
	{ label: m.players_gender_not_set(), value: null },
	{ label: m.players_gender_male(), value: Gender.MALE },
	{ label: m.players_gender_female(), value: Gender.FEMALE },
];

type PlayerFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: {
		name: string;
		year: number;
		qttr: number;
		gender: Gender | null;
	};
	onSubmit: (updates: {
		name: string;
		year: number;
		qttr: number;
		gender: Gender | null;
	}) => Promise<void>;
};
export const PlayerForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = {
		gender: null,
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
				<DialogTitle className="sr-only">{m.common_dialog()}</DialogTitle>
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
										? m.players_name_must_be_at_least_2_characters_long()
										: undefined,
							}}
						>
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{m.common_name()}:</Label>
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
										? m.players_year_of_birth_must_be_set()
										: undefined,
							}}
						>
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>
										{m.players_year_of_birth()}:
									</Label>
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
						<form.Field name="gender">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{m.players_gender()}:</Label>
									<Select
										value={field.state.value}
										onValueChange={(value) =>
											field.handleChange(value as Gender | null)
										}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue>
												{(value: Gender | null) =>
													genderOptions.find((option) => option.value === value)
														?.label
												}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{genderOptions.map((option) => (
												<SelectItem
													key={option.value ?? "unset"}
													value={option.value}
												>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
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
										? m.players_qttr_must_be_set_0_is_allowed()
										: undefined,
							}}
						>
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{m.common_qttr()}:</Label>
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
						{m.common_close()}
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

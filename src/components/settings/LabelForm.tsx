import { useForm } from "@tanstack/react-form";
import { CheckIcon } from "lucide-react";
import type { LabelColor } from "@/api/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { catppuccinColorNames, cn, getCatppuccinColorStyle } from "@/lib/utils";
import { m } from "@/paraglide/messages";

type LabelFormValues = {
	name: string;
	color: LabelColor;
	countsForStats: boolean;
};

type LabelFormProps = {
	open: boolean;
	title: string;
	defaultValues: LabelFormValues;
	onOpenChange: (open: boolean) => void;
	onSubmit: (values: LabelFormValues) => void;
	submitLabel: string;
};

export const LabelForm = ({
	open,
	title,
	defaultValues,
	onOpenChange,
	onSubmit,
	submitLabel,
}: LabelFormProps) => {
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => onSubmit(value),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={false}>
				<DialogTitle>{title}</DialogTitle>
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
								<FieldLabel htmlFor={field.name}>{m.labels_name()}:</FieldLabel>
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
					<form.Field name="color">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<FieldLabel>{m.labels_color()}:</FieldLabel>
								<div className="flex flex-wrap gap-2">
									{catppuccinColorNames.map((colorName) => {
										const style = getCatppuccinColorStyle(colorName);
										const isSelected = field.state.value === colorName;
										return (
											<button
												key={colorName}
												type="button"
												aria-label={colorName}
												aria-pressed={isSelected}
												onClick={() => field.handleChange(colorName)}
												className={cn(
													"flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
													isSelected && "ring-2 ring-foreground",
												)}
												style={{ backgroundColor: style.backgroundColor }}
											>
												{isSelected && (
													<CheckIcon
														className="size-4"
														style={{ color: style.foregroundColor }}
													/>
												)}
											</button>
										);
									})}
								</div>
							</fieldset>
						)}
					</form.Field>
					<form.Field name="countsForStats">
						{(field) => (
							<label
								htmlFor={field.name}
								className="flex cursor-pointer items-center gap-2"
							>
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onBlur={field.handleBlur}
									onCheckedChange={(c) => field.handleChange(c === true)}
								/>
								<span className="text-sm">{m.labels_counts_for_stats()}</span>
							</label>
						)}
					</form.Field>
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
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

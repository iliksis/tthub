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
import type { Season } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type TeamFormValues = {
	title: string;
	league: string;
	clickTTGroupId: string;
	seasonId: string;
};

type TeamFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: TeamFormValues;
	// Only passed (and only shown) on create — a Team's season is never
	// editable afterward.
	seasonOptions?: Season[];
	onSubmit: (updates: TeamFormValues) => Promise<void>;
};

export const TeamForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = { clickTTGroupId: "", league: "", seasonId: "", title: "" },
	seasonOptions,
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
					{seasonOptions && (
						<div>
							<form.Field name="seasonId">
								{(field) => (
									<fieldset className="flex flex-col gap-1.5">
										<Label htmlFor={field.name}>{t("Season")}:</Label>
										<Select
											items={Object.fromEntries(
												seasonOptions.map((s) => [s.id, s.name]),
											)}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value ?? "")}
										>
											<SelectTrigger id={field.name} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{seasonOptions.map((season) => (
													<SelectItem key={season.id} value={season.id}>
														{season.name}
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

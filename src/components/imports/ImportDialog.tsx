import { useForm } from "@tanstack/react-form";
import * as React from "react";
import { toast } from "sonner";
import { runImport } from "@/api/imports";
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
import { useMutation } from "@/hooks/useMutation";
import type { ImporterConfigField } from "@/importers/types";
import { t } from "@/lib/text";

type ImportDialogImporter = {
	id: string;
	name: string;
	configFields: ImporterConfigField[];
};

type ImportDialogProps = {
	importer: ImportDialogImporter | null;
	onClose: () => void;
};

const toDefaultValues = (configFields: ImporterConfigField[]) =>
	Object.fromEntries(configFields.map((field) => [field.key, ""])) as Record<
		string,
		string
	>;

export const ImportDialog = ({ importer, onClose }: ImportDialogProps) => {
	const importMutation = useMutation({
		fn: runImport,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			toast.success(ctx.data.message);
			onClose();
		},
	});

	const form = useForm({
		defaultValues: toDefaultValues(importer?.configFields ?? []),
		onSubmit: async ({ value }) => {
			if (!importer) return;
			await importMutation.mutate({
				data: { config: value, importerId: importer.id },
			});
		},
	});

	// The field set differs per importer, so the form must be re-initialized
	// with a fresh shape whenever a different importer's dialog is opened.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-init on importer change
	React.useEffect(() => {
		if (importer) {
			form.reset(toDefaultValues(importer.configFields));
		}
	}, [importer?.id]);

	return (
		<Dialog
			open={importer !== null}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<DialogContent>
				<DialogTitle>{importer?.name}</DialogTitle>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					{importer?.configFields.map((configField) => (
						<form.Field
							key={configField.key}
							name={configField.key}
							validators={{
								onChange: ({ value }) =>
									configField.required && value.trim().length === 0
										? t("This field is required")
										: undefined,
							}}
						>
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>
										{configField.label}
										{!configField.required && ` ${t("(optional)")}`}:
									</Label>
									{configField.description && (
										<p className="text-muted-foreground text-xs">
											{configField.description}
										</p>
									)}
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										type={configField.type}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{!field.state.meta.isValid && (
										<p className="text-destructive text-sm">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</fieldset>
							)}
						</form.Field>
					))}
				</form>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								disabled={!canSubmit || isSubmitting}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
							>
								{isSubmitting ? t("Loading…") : t("Start Import")}
							</Button>
						)}
					</form.Subscribe>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

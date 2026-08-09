import { useForm } from "@tanstack/react-form";
import * as React from "react";
import { toast } from "sonner";
import { getImportProgress, runImport } from "@/api/imports";
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

type ImportProgress = {
	status: "running" | "done" | "error";
	imported: number;
	skipped: number;
	total?: number;
	message?: string;
};

const PROGRESS_POLL_INTERVAL_MS = 500;

const toDefaultValues = (configFields: ImporterConfigField[]) =>
	Object.fromEntries(configFields.map((field) => [field.key, ""])) as Record<
		string,
		string
	>;

export const ImportDialog = ({ importer, onClose }: ImportDialogProps) => {
	const [jobId, setJobId] = React.useState<string | null>(null);
	const [progress, setProgress] = React.useState<ImportProgress | null>(null);

	const importMutation = useMutation({
		fn: runImport,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			setProgress({ imported: 0, skipped: 0, status: "running" });
			setJobId(ctx.data.data.jobId);
		},
	});

	// Polls job progress while an import is running, so the card shows how
	// many entities have already been created and how many are left.
	// biome-ignore lint/correctness/useExhaustiveDependencies: onClose is stable per open dialog
	React.useEffect(() => {
		if (!jobId) return;

		let cancelled = false;
		const interval = setInterval(async () => {
			try {
				const { data } = await getImportProgress({ data: { jobId } });
				if (cancelled) return;
				setProgress(data);
				if (data.status !== "running") {
					clearInterval(interval);
					setJobId(null);
					if (data.status === "done") {
						toast.success(data.message ?? t("Import started"));
						onClose();
					} else {
						toast.error(data.message ?? t("Import not found"));
					}
				}
			} catch (err) {
				if (cancelled) return;
				clearInterval(interval);
				setJobId(null);
				toast.error((err as Error).message);
			}
		}, PROGRESS_POLL_INTERVAL_MS);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [jobId]);

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
			setProgress(null);
			setJobId(null);
		}
	}, [importer?.id]);

	const isImporting = jobId !== null;

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
										disabled={isImporting}
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
				{progress && (
					<div className="flex flex-col gap-1.5">
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
								style={{
									width: progress.total
										? `${Math.min(100, (progress.imported / progress.total) * 100)}%`
										: progress.status === "running"
											? "100%"
											: "0%",
								}}
							/>
						</div>
						<p className="text-muted-foreground text-xs">
							{progress.total
								? t(
										"{0} of {1} imported",
										progress.imported.toString(),
										progress.total.toString(),
									)
								: t("Loading…")}
							{progress.skipped > 0 &&
								` · ${t("{0} skipped", progress.skipped.toString())}`}
						</p>
					</div>
				)}
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
								disabled={!canSubmit || isSubmitting || isImporting}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
							>
								{isImporting || isSubmitting
									? t("Loading…")
									: t("Start Import")}
							</Button>
						)}
					</form.Subscribe>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

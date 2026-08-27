import { useRouter } from "@tanstack/react-router";
import { CalendarDaysIcon, PlugIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { setImporterEnabled } from "@/api/imports";
import { ImportDialog } from "@/components/imports/ImportDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useMutation } from "@/hooks/useMutation";
import type { ImporterConfigField } from "@/importers/types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
	holiday: CalendarDaysIcon,
};

type Importer = {
	id: string;
	name: string;
	description: string;
	version: string;
	enabled: boolean;
	configFields: ImporterConfigField[];
};

type ImporterAvailabilityProps = {
	importers: Importer[];
	canManage: boolean;
};

export const ImporterAvailability = ({
	importers,
	canManage,
}: ImporterAvailabilityProps) => {
	const router = useRouter();
	const reducedMotion = usePrefersReducedMotion();
	const [openImporter, setOpenImporter] = React.useState<Importer | null>(null);

	const toggleMutation = useMutation({
		fn: setImporterEnabled,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{importers.map((importer, i) => {
					const Icon = icons[importer.id] ?? PlugIcon;
					return (
						<div
							key={importer.id}
							className={cn(
								"flex flex-col gap-4 rounded-lg border border-border/60 p-4 transition-opacity duration-200",
								!reducedMotion &&
									"fill-mode-both animate-in fade-in zoom-in-95 duration-200 ease-out",
							)}
							style={
								reducedMotion ? undefined : { animationDelay: `${i * 70}ms` }
							}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-3">
									<div
										className={cn(
											"flex size-10 shrink-0 items-center justify-center rounded-lg",
											importer.enabled
												? "bg-primary/10 text-primary"
												: "bg-muted text-muted-foreground",
										)}
									>
										<Icon className="size-5" />
									</div>
									<div className="font-medium text-sm">{importer.name}</div>
								</div>
								{canManage && (
									<Switch
										aria-label={importer.name}
										checked={importer.enabled}
										onCheckedChange={(checked) =>
											toggleMutation.mutate({
												data: {
													enabled: checked === true,
													importerId: importer.id,
												},
											})
										}
									/>
								)}
							</div>
							<div className="flex-1 text-muted-foreground text-sm">
								{importer.description}
							</div>
							<Button
								size="sm"
								className="w-full"
								disabled={!importer.enabled}
								onClick={() => setOpenImporter(importer)}
							>
								{importer.enabled
									? m.imports_start_import()
									: m.imports_import_disabled()}
							</Button>
						</div>
					);
				})}
			</div>
			<ImportDialog
				importer={openImporter}
				onClose={() => setOpenImporter(null)}
			/>
		</>
	);
};

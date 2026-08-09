import { useRouter } from "@tanstack/react-router";
import { CalendarDaysIcon, PlugIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { setImporterEnabled } from "@/api/imports";
import { ImportDialog } from "@/components/imports/ImportDialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useMutation } from "@/hooks/useMutation";
import type { ImporterConfigField } from "@/importers/types";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

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
						<Card
							key={importer.id}
							className={cn(
								"transition-opacity duration-200",
								!reducedMotion &&
									"fill-mode-both animate-in fade-in zoom-in-95 duration-200 ease-out",
							)}
							style={
								reducedMotion ? undefined : { animationDelay: `${i * 70}ms` }
							}
						>
							<CardHeader className="flex flex-row items-start justify-between gap-3">
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
									<CardTitle className="text-sm">{importer.name}</CardTitle>
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
							</CardHeader>
							<CardContent className="text-muted-foreground text-sm">
								{importer.description}
							</CardContent>
							<CardFooter>
								<Button
									size="sm"
									className="w-full"
									disabled={!importer.enabled}
									onClick={() => setOpenImporter(importer)}
								>
									{importer.enabled ? t("Start Import") : t("Import Disabled")}
								</Button>
							</CardFooter>
						</Card>
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

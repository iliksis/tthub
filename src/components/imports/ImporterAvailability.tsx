import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { setImporterEnabled } from "@/api/imports";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";

type ImporterAvailabilityProps = {
	importers: {
		id: string;
		name: string;
		description: string;
		enabled: boolean;
	}[];
};

export const ImporterAvailability = ({
	importers,
}: ImporterAvailabilityProps) => {
	const router = useRouter();

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
		<div>
			<h1>{t("Available Importers")}</h1>
			<div className="mt-2 flex flex-col gap-2">
				{importers.map((importer) => (
					<div key={importer.id} className="flex items-center gap-2">
						<Checkbox
							id={`importer-${importer.id}`}
							checked={importer.enabled}
							onCheckedChange={(checked) =>
								toggleMutation.mutate({
									data: { enabled: checked === true, importerId: importer.id },
								})
							}
						/>
						<Label htmlFor={`importer-${importer.id}`}>
							{importer.name} — {importer.description}
						</Label>
					</div>
				))}
			</div>
		</div>
	);
};

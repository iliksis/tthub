import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { cloneTeamsFromSeason } from "@/api/teams";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@/hooks/useMutation";
import type { Season } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type CloneTeamsModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	targetSeason: Season;
	sourceOptions: Season[];
};

export const CloneTeamsModal = ({
	open,
	onOpenChange,
	targetSeason,
	sourceOptions,
}: CloneTeamsModalProps) => {
	const router = useRouter();

	const cloneMutation = useMutation({
		fn: cloneTeamsFromSeason,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			onOpenChange(false);
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const form = useForm({
		defaultValues: { sourceSeasonId: sourceOptions[0]?.id ?? "" },
		onSubmit: async ({ value }) => {
			if (!value.sourceSeasonId) return;
			cloneMutation.mutate({
				data: {
					sourceSeasonId: value.sourceSeasonId,
					targetSeasonId: targetSeason.id,
				},
			});
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
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
					<form.Field name="sourceSeasonId">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Source season")}:</Label>
								<Select
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value ?? "")}
								>
									<SelectTrigger id={field.name} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{sourceOptions.map((season) => (
											<SelectItem key={season.id} value={season.id}>
												{season.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</fieldset>
						)}
					</form.Field>
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<Button
						type="submit"
						disabled={sourceOptions.length === 0}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{t("Clone teams from...")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

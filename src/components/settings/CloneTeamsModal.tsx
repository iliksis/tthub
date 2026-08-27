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
import { EntitySelect } from "@/components/ui/entity-select";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/useMutation";
import type { Season } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";

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
				<DialogTitle className="sr-only">{m.common_dialog()}</DialogTitle>
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
								<Label htmlFor={field.name}>{m.seasons_source_season()}:</Label>
								<EntitySelect
									id={field.name}
									items={sourceOptions}
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value ?? "")}
								/>
							</fieldset>
						)}
					</form.Field>
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{m.common_close()}
					</DialogClose>
					<Button
						type="submit"
						disabled={
							sourceOptions.length === 0 || cloneMutation.status === "pending"
						}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{m.seasons_clone_teams_from()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

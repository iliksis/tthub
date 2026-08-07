import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { updatePlacement } from "@/api/placements";
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
import type { Placement } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type UpdatePlacementFormProps = {
	open: boolean;
	onClose: () => void;
	placement: Placement;
};
export const UpdatePlacementForm = ({
	open,
	onClose,
	placement,
}: UpdatePlacementFormProps) => {
	const router = useRouter();

	const updateMutation = useMutation({
		fn: updatePlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				onClose();
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			placement: placement.placement ?? "",
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutate({
				data: {
					appointmentId: placement.appointmentId,
					category: placement.category,
					playerId: placement.playerId,
					updates: {
						placement: value.placement,
					},
				},
			});
		},
	});

	const _onClose = () => {
		onClose();
		form.reset();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) _onClose();
			}}
		>
			<DialogContent className="md:max-w-xl md:mx-auto" showCloseButton={false}>
				<DialogTitle className="sr-only">{t("Dialog")}</DialogTitle>
				<form className="flex flex-col gap-4" onSubmit={form.handleSubmit}>
					<div>
						<form.Field name="placement">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Placement")}:</Label>
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
					</div>
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
						{t("Update")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

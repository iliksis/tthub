import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { updatePlacement } from "@/api/placements";
import { useMutation } from "@/hooks/useMutation";
import type { Placement } from "@/lib/prisma/client";
import { Modal } from "../modal/Modal";
import { notify } from "../Toast";

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
			notify({ text: data.message, status: "error" });
		},
	});

	const form = useForm({
		defaultValues: {
			placement: placement.placement ?? "",
		},
		onSubmit: async ({ value }) => {
			await updateMutation.mutate({
				data: {
					playerId: placement.playerId,
					appointmentId: placement.appointmentId,
					category: placement.category,
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
		<Modal
			open={open}
			onClose={_onClose}
			className="modal-bottom"
			onRenderActionButton={() => (
				<button
					type="submit"
					className="btn btn-primary"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					Submit
				</button>
			)}
		>
			<form className="flex flex-col gap-2" onSubmit={form.handleSubmit}>
				<div>
					<form.Field name="placement">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									Placement:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
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
		</Modal>
	);
};

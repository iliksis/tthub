import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { createPlacement } from "@/api/placements";
import { useMutation } from "@/hooks/useMutation";
import type { Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";
import { Modal } from "../modal/Modal";

type CreateCategoryProps = {
	open: boolean;
	onClose: () => void;
	categories: string[];
	players: Player[];
	appointmentId: string;
};
export const CreatePlacement = ({
	open,
	onClose,
	categories,
	appointmentId,
	players,
}: CreateCategoryProps) => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createPlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				router.invalidate();
				onClose();
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			category: "",
			placement: "",
			player: "",
		},
		onSubmit: async ({ value }) => {
			await createMutation.mutate({
				data: {
					appointmentId,
					category: value.category,
					placement: value.placement,
					playerId: value.player,
				},
			});
		},
	});

	const _onClose = () => {
		onClose();
		form.reset();
	};

	if (!open) return null;

	return (
		<Modal
			open={open}
			onClose={_onClose}
			className="modal-bottom"
			modalBoxClassName="md:max-w-xl md:mx-auto"
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
					{t("Create")}
				</button>
			)}
		>
			<form className="flex flex-col gap-2" onSubmit={form.handleSubmit}>
				<div>
					<form.Field name="player">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Player")}:
								</label>
								<select
									className="select select-primary w-full"
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								>
									<option disabled selected>
										{t("Choose a player")}
									</option>
									{players.map((p) => (
										<option
											key={p.id}
											value={p.id}
											className="before:content-[attr(data-before)] before:opacity-60"
											data-before={calculateAgeGroup(p.year)}
										>
											{p.name}
										</option>
									))}
								</select>
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field name="category">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Category")}:
								</label>
								<input
									id={field.name}
									className="input input-primary w-full"
									list="categories"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<datalist id="categories">
									{categories.map((c) => (
										<option key={c} value={c} />
									))}
								</datalist>
							</fieldset>
						)}
					</form.Field>
				</div>
				<div>
					<form.Field name="placement">
						{(field) => (
							<fieldset className="fieldset">
								<label className="label" htmlFor={field.name}>
									{t("Placement")}:
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

import { useRouteContext, useRouter } from "@tanstack/react-router";
import { EditIcon, Plus, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deletePlacement } from "@/api/placements";
import { InternalLink } from "@/components/InternalLink";
import { useMutation } from "@/hooks/useMutation";
import type { Placement, Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { Modal } from "../modal/Modal";
import { CreatePlacement } from "./CreatePlacement";
import { UpdatePlacementForm } from "./UpdatePlacementForm";

type ParticipantModalProps = {
	open: boolean;
	onClose: () => void;

	placements: (Placement & { player: Player })[];
	players: Player[];
	appointmentId: string;
	categories: string[];
};
export const ParticipantModal = ({
	open,
	onClose,
	placements,
	categories,
	players,
	appointmentId,
}: ParticipantModalProps) => {
	const { user } = useRouteContext({ from: "__root__" });
	const canEdit = user?.role === "USER";
	const router = useRouter();

	const [showCreate, setShowCreate] = React.useState(false);
	const [showUpdate, setShowUpdate] = React.useState<Placement | undefined>();

	const groupedPlacements = React.useMemo(() => {
		const grouped = placements.reduce(
			(acc, placement) => {
				const category = acc.find((c) => c.category === placement.category);
				if (category) {
					category.placements.push(placement);
				} else {
					acc.push({
						category: placement.category,
						placements: [placement],
					});
				}
				return acc;
			},
			[] as { category: string; placements: typeof placements }[],
		);

		return grouped.sort((a, b) => a.category.localeCompare(b.category));
	}, [placements]);

	const onCreateCategory = () => {
		setShowCreate(true);
	};
	const onCloseCreateCategory = () => {
		setShowCreate(false);
	};

	const onUpdatePlacement = (placement: Placement) => {
		setShowUpdate(placement);
	};
	const onCloseUpdatePlacement = () => {
		setShowUpdate(undefined);
	};

	const deleteMutation = useMutation({
		fn: deletePlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				return;
			}
			toast.error(data.message);
		},
	});

	const onDeletePlacement = (placement: Placement) => async () => {
		await deleteMutation.mutate({
			data: {
				appointmentId: placement.appointmentId,
				category: placement.category,
				playerId: placement.playerId,
			},
		});
	};

	return (
		<>
			<Modal
				open={open}
				onClose={onClose}
				className="modal-end"
				modalBoxClassName="w-[80vw] max-w-md"
			>
				<div className="flex items-center">
					<h2 className="flex-1">{t("Participants")}</h2>
					{!canEdit && (
						<button
							type="button"
							className="shrink btn btn-primary btn-square btn-ghost"
							title={t("Create")}
							onClick={onCreateCategory}
						>
							<Plus className="size-4" />
						</button>
					)}
				</div>
				{groupedPlacements.map((group) => (
					<div key={group.category} className="flex flex-col gap-2 mt-8">
						<div className="flex items-center">
							<h3 className="flex-1 font-bold">{group.category}</h3>
						</div>
						{group.placements.map((p) => (
							<div
								key={`${p.appointmentId}-${p.playerId}`}
								className="flex items-center gap-2"
							>
								<div className="flex-1">
									<InternalLink
										to="/players/$playerId"
										params={{ playerId: p.player.id }}
									>
										{p.player.name}
									</InternalLink>
								</div>
								<div className="flex-1">
									<p>{p.placement}</p>
								</div>
								{!canEdit && (
									<>
										<button
											type="button"
											className="btn btn-square btn-ghost"
											title={t("Edit")}
											onClick={() => onUpdatePlacement(p)}
										>
											<EditIcon className="size-4" />
										</button>
										<button
											type="button"
											className="btn btn-square btn-error btn-ghost"
											title={t("Delete")}
											onClick={onDeletePlacement(p)}
										>
											<Trash2Icon className="size-4" />
										</button>
									</>
								)}
							</div>
						))}
					</div>
				))}
			</Modal>
			<CreatePlacement
				open={showCreate}
				onClose={onCloseCreateCategory}
				categories={categories}
				players={players}
				appointmentId={appointmentId}
			/>
			{showUpdate && (
				<UpdatePlacementForm
					open={!!showUpdate}
					onClose={onCloseUpdatePlacement}
					placement={showUpdate}
				/>
			)}
		</>
	);
};

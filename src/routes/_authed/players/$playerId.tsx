import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deletePlayer, getPlayer, updatePlayer } from "@/api/players";
import { getTeams } from "@/api/teams";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup, isEditorOrAdmin } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/players/$playerId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const [playerRes, teamsRes] = await Promise.all([
			getPlayer({ data: { id: params.playerId } }),
			getTeams(),
		]);
		return { player: playerRes.data, teams: teamsRes.data };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.player?.name }],
	}),
});

type Placement = NonNullable<
	ReturnType<typeof Route.useLoaderData>["player"]
>["placements"][number];

const placementColumns: DetailsListColumn<Placement>[] = [
	{
		key: "date",
		label: t("Date"),
		render: (item) =>
			new Date(item.appointment.startDate).toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "2-digit",
			}),
	},
	{
		key: "title",
		label: t("Appointment"),
		render: (item) => (
			<Link to="/appts/$apptId" params={{ apptId: item.appointment.id }}>
				{item.appointment.title}
			</Link>
		),
	},
	{
		key: "category",
		label: t("Category"),
		render: (item) => item.category,
	},
	{
		key: "placement",
		label: t("Placement"),
		render: (item) => item.placement,
	},
];

function RouteComponent() {
	const router = useRouter();
	const { player, teams } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });

	const canEdit = isEditorOrAdmin(user?.role);

	const [isEditing, setIsEditing] = React.useState(false);

	const [isDeleting, setIsDeleting] = React.useState(false);
	const deletePlayerServerFn = useServerFn(deletePlayer);

	const updatePlayerMutation = useMutation({
		fn: updatePlayer,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	if (!player) return <div>{t("An Error occurred")}</div>;

	const onEdit = () => {
		setIsEditing(true);
	};
	const onStopEditing = () => {
		setIsEditing(false);
	};

	const onOpenDelete = () => {
		setIsDeleting(true);
	};
	const onStopDeleting = () => {
		setIsDeleting(false);
	};

	const onDelete = async () => {
		try {
			const res = await deletePlayerServerFn({
				data: { id: player.id },
			});
			await router.invalidate();
			toast.success(res.message);
			await router.navigate({
				to: "..",
			});
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	const onItemClick = async (item: Placement) => {
		await router.navigate({
			params: { apptId: item.appointmentId },
			to: "/appts/$apptId",
		});
	};

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-6">
			<div className="flex flex-col items-center lg:rounded-xl lg:bg-card lg:p-6 text-center lg:sticky lg:top-6">
				<div className="font-bold text-lg hidden lg:block">{player.name}</div>
				<div className="mb-4 text-muted-foreground text-sm self-start lg:self-center">
					{calculateAgeGroup(player.year)} · {player.year}
				</div>
				<div className="mb-4 flex w-full gap-2">
					<div className="flex-1 rounded-md bg-muted/50 p-3 text-left">
						<div className="mb-1 text-muted-foreground text-xs">
							{t("QTTR")}
						</div>
						<div className="font-semibold text-success text-sm">
							{player.qttr}
						</div>
					</div>
					<div className="flex-1 rounded-md bg-muted/50 p-3 text-left">
						<div className="mb-1 text-muted-foreground text-xs">
							{t("Team")}
						</div>
						<div className="font-semibold text-sm">
							{player.team ? (
								<Link to="/teams/$teamId" params={{ teamId: player.team.id }}>
									{player.team.title}
								</Link>
							) : (
								t("No team set")
							)}
						</div>
					</div>
				</div>
				{canEdit && (
					<div className="flex w-full gap-2">
						<Button
							variant="outline"
							size="sm"
							className="flex-1"
							title={t("Update player")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							title={t("Delete player")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}
			</div>

			<div className="min-w-0 rounded-xl bg-card">
				<DetailsList
					items={player.placements}
					getItemId={(item) => `${item.appointmentId}-${item.category}`}
					columns={placementColumns}
					onItemClick={onItemClick}
					selectMode="none"
				/>
			</div>

			{canEdit && (
				<>
					<PlayerForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updatePlayerMutation.mutate({
								data: {
									...values,
									id: player.id,
									team: values.team ?? undefined,
								},
							});
						}}
						submitLabel={t("Update")}
						defaultValues={{ ...player, team: player.team?.id ?? null }}
						teams={teams ?? []}
					/>
					<DeleteModal
						label={t("Are you sure you want to delete this player?")}
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

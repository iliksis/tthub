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
import { InternalLink } from "@/components/InternalLink";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/players/$playerId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const [playerData, teamsData] = await Promise.all([
			getPlayer({ data: { id: params.playerId } }),
			getTeams(),
		]);
		const playerRes = await playerData.json();
		const teamsRes = await teamsData.json();
		if (playerData.status >= 400) {
			throw new Error(playerRes.message);
		}
		if (teamsData.status >= 400) {
			throw new Error(teamsRes.message);
		}
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
		render: (item) => item.appointment.title,
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

	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isEditing, setIsEditing] = React.useState(false);

	const [isDeleting, setIsDeleting] = React.useState(false);
	const deletePlayerServerFn = useServerFn(deletePlayer);

	const updatePlayerMutation = useMutation({
		fn: updatePlayer,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
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
		const res = await deletePlayerServerFn({
			data: { id: player.id },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			toast.success(data.message);
			await router.navigate({
				to: "..",
			});
			return;
		}
		toast.error(data.message);
	};

	const onItemClick = async (item: Placement) => {
		await router.navigate({
			params: { apptId: item.appointmentId },
			to: "/appts/$apptId",
		});
	};

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-6">
			<div className="flex flex-col items-center rounded-xl bg-card p-6 text-center lg:sticky lg:top-6">
				<div className="font-bold text-lg">{player.name}</div>
				<div className="mb-4 text-muted-foreground text-sm">
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
								<InternalLink
									to="/teams/$teamId"
									params={{ teamId: player.team.id }}
									className="text-primary hover:underline"
								>
									{player.team.title}
								</InternalLink>
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

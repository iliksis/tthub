import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CogIcon, EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deletePlayer, getPlayer, updatePlayer } from "@/api/players";
import { getTeams } from "@/api/teams";
import { DetailsList } from "@/components/DetailsList";
import { InternalLink } from "@/components/InternalLink";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Card } from "@/components/ValueCard";
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

	return (
		<div>
			<div className="grid grid-cols-4 gap-2">
				<Card title={t("Year of birth")} gridRows={3}>
					<p>
						{player.year}{" "}
						<span className="opacity-75">
							- {calculateAgeGroup(player.year)}
						</span>
					</p>
				</Card>
				<Card title={t("QTTR")} gridRows={1}>
					<p>{player.qttr}</p>
				</Card>
				<Card title={t("Team")} gridRows={4}>
					<p>
						{player.team ? (
							<InternalLink
								to="/teams/$teamId"
								params={{ teamId: player.team.id }}
							>
								{player.team.title}
							</InternalLink>
						) : (
							t("No team set")
						)}
					</p>
				</Card>
				<Card gridRows={4}>
					<DetailsList
						items={player.placements}
						getItemId={(item) => `${item.appointmentId}-${item.category}`}
						columns={[
							{
								key: "date",
								label: t("Date"),
								render: (item) =>
									new Date(item.appointment.startDate).toLocaleDateString(
										"de-DE",
										{
											day: "2-digit",
											month: "2-digit",
											year: "2-digit",
										},
									),
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
						]}
						onItemClick={async (item) => {
							await router.navigate({
								params: { apptId: item.appointmentId },
								to: "/appts/$apptId",
							});
						}}
						selectMode="none"
					/>
				</Card>
			</div>
			{canEdit && (
				<>
					<div className="fab">
						{/** biome-ignore lint/a11y/useSemanticElements: fixes safari bug */}
						<div className="btn btn-lg btn-circle" role="button" tabIndex={0}>
							<CogIcon className="size-4" />
						</div>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title={t("Update player")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</button>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title={t("Delete player")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</button>
					</div>

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

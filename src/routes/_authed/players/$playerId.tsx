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
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { InternalLink } from "@/components/InternalLink";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ValueCard";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup, shortenUserName } from "@/lib/utils";

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

	const tournamentCount = new Set(player.placements.map((p) => p.appointmentId))
		.size;

	return (
		<div>
			{/* Desktop toolbar */}
			<div className="mb-4 hidden items-center gap-2 lg:flex">
				<span className="text-muted-foreground text-sm">{t("Players")} /</span>
				<span className="flex-1 font-semibold text-[15px]">{player.name}</span>
				{canEdit && (
					<>
						<Button variant="outline" size="sm" onClick={onEdit}>
							<EditIcon className="size-4" />
							{t("Update player")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
							{t("Delete player")}
						</Button>
					</>
				)}
			</div>

			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
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
							columns={placementColumns}
							onItemClick={onItemClick}
							selectMode="none"
						/>
					</Card>
				</div>
				{canEdit && (
					<div className="fab">
						<Button
							asChild
							variant="secondary"
							size="icon-lg"
							role="button"
							tabIndex={0}
						>
							<div>
								<CogIcon className="size-4" />
							</div>
						</Button>
						<Button
							variant="secondary"
							size="icon-lg"
							type="button"
							title={t("Update player")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon-lg"
							type="button"
							title={t("Delete player")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}
			</div>

			{/* Desktop layout: profile column + results */}
			<div className="hidden lg:grid lg:grid-cols-[300px_1fr] lg:gap-6">
				<div className="flex flex-col items-center rounded-xl bg-card p-6 text-center">
					<div className="mb-3 flex size-20 items-center justify-center rounded-full bg-primary font-bold text-2xl text-primary-foreground">
						{shortenUserName(player.name)}
					</div>
					<div className="font-bold text-lg">{player.name}</div>
					<div className="mb-4 text-muted-foreground text-sm">
						{calculateAgeGroup(player.year)} · {player.year}
					</div>
					<div className="mb-3 flex w-full gap-2">
						<div className="flex-1 rounded-md bg-muted/50 p-3">
							<div className="font-bold text-success text-xl">
								{player.qttr}
							</div>
							<div className="mt-0.5 text-muted-foreground text-xs">
								{t("QTTR")}
							</div>
						</div>
						<div className="flex-1 rounded-md bg-muted/50 p-3">
							<div className="font-bold text-xl">{tournamentCount}</div>
							<div className="mt-0.5 text-muted-foreground text-xs">
								{t("Tournaments")}
							</div>
						</div>
					</div>
					<div className="w-full rounded-md bg-muted/50 p-3 text-left">
						<div className="mb-1 text-muted-foreground text-xs">
							{t("Team")}
						</div>
						<div className="font-semibold text-sm">
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
						</div>
					</div>
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

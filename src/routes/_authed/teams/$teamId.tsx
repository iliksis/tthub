import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EditIcon, Trash2Icon, TrophyIcon, UsersIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deleteTeam, getTeam, updateTeam } from "@/api/teams";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerRosterRow } from "@/components/teams/PlayerRosterRow";
import { TeamForm } from "@/components/teams/TeamForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head uses loaderData
export const Route = createFileRoute("/_authed/teams/$teamId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getTeam({ data: { id: params.teamId } });
		const res = await data.json();
		if (data.status < 400) {
			return { team: res.data };
		}
		throw new Error(res.message);
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.team?.title }],
	}),
});

type TeamPlayer = NonNullable<
	ReturnType<typeof Route.useLoaderData>["team"]
>["players"][number];

const rosterColumns: DetailsListColumn<TeamPlayer>[] = [
	{
		key: "name",
		label: t("Name"),
		render: (item) => (
			<Link to="/players/$playerId" params={{ playerId: item.id }}>
				{item.name}
			</Link>
		),
	},
	{
		key: "ageGroup",
		label: t("Age Group"),
		render: (item) => calculateAgeGroup(item.year),
	},
	{
		key: "qttr",
		label: t("QTTR"),
		render: (item) => item.qttr,
		sortable: true,
		sortFn: (a, b) => a.qttr - b.qttr,
	},
];

function RouteComponent() {
	const { team } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isEditing, setIsEditing] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const deleteTeamServerFn = useServerFn(deleteTeam);

	const updateTeamMutation = useMutation({
		fn: updateTeam,
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

	if (!team) return <div>{t("An Error occurred")}</div>;

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
		const res = await deleteTeamServerFn({
			data: { id: team.id },
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

	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);

	return (
		<div>
			{/* Desktop toolbar */}
			<div className="mb-4 hidden flex-wrap items-center gap-x-3 gap-y-2 lg:flex">
				<span className="font-semibold text-[15px]">{team.title}</span>
				<span className="text-muted-foreground text-sm">·</span>
				<span className="text-muted-foreground text-sm">{team.league}</span>
				{team.placement && <Badge variant="default">{team.placement}</Badge>}
				{canEdit && (
					<div className="ml-auto flex gap-2">
						<Button variant="outline" size="sm" onClick={onEdit}>
							<EditIcon className="size-4" />
							{t("Update team")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
							{t("Delete team")}
						</Button>
					</div>
				)}
			</div>

			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
					<span className="text-muted-foreground text-sm">{team.league}</span>
					{team.placement && <Badge variant="default">{team.placement}</Badge>}
				</div>
				{sortedPlayers.length === 0 ? (
					<div className="flex flex-col items-center gap-2 rounded-lg bg-card p-8 text-center text-muted-foreground">
						<UsersIcon className="size-5" />
						{t("No items found")}
					</div>
				) : (
					<div className="flex flex-col gap-2.5">
						{sortedPlayers.map((player) => (
							<PlayerRosterRow key={player.id} player={player} variant="card" />
						))}
					</div>
				)}
				<div className="mt-4 flex items-center gap-3 rounded-lg border border-border/60 border-dashed p-4 text-muted-foreground text-sm">
					<TrophyIcon className="size-4 shrink-0" />
					{t("League table and fixtures are not available yet.")}
				</div>
				{canEdit && (
					<div className="fab">
						<Button
							variant="secondary"
							size="icon-lg"
							type="button"
							title={t("Update team")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="secondary"
							size="icon-lg"
							type="button"
							title={t("Delete team")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}
			</div>

			{/* Desktop layout: roster-first, league table demoted to a placeholder strip */}
			<div className="hidden lg:block">
				<div className="rounded-lg bg-card">
					<DetailsList
						items={sortedPlayers}
						getItemId={(item) => item.id}
						columns={rosterColumns}
						selectMode="none"
						onItemClick={async (item) => {
							await router.navigate({
								params: { playerId: item.id },
								to: "/players/$playerId",
							});
						}}
					/>
				</div>
				<div className="mt-4 flex items-center gap-3 rounded-lg border border-border/60 border-dashed p-4 text-muted-foreground text-sm">
					<TrophyIcon className="size-4 shrink-0" />
					{t("League table and fixtures are not available yet.")}
				</div>
			</div>

			{canEdit && (
				<>
					<TeamForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updateTeamMutation.mutate({
								data: { id: team.id, ...values },
							});
						}}
						submitLabel={t("Update")}
						defaultValues={{ league: team.league ?? "", title: team.title }}
					/>
					<DeleteModal
						label={t("Are you sure you want to delete this team?")}
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

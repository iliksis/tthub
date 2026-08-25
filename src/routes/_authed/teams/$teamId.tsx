import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deleteTeam, getTeam, updateTeam } from "@/api/teams";
import { AppointmentRow } from "@/components/AppointmentRow";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Section } from "@/components/Section";
import { StandingsTable } from "@/components/teams/StandingsTable";
import { TeamForm } from "@/components/teams/TeamForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup, isEditorOrAdmin } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head uses loaderData
export const Route = createFileRoute("/_authed/teams/$teamId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const res = await getTeam({ data: { id: params.teamId } });
		return { team: res.data };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.team?.title }],
	}),
});

type TeamPlayer = NonNullable<
	ReturnType<typeof Route.useLoaderData>["team"]
>["players"][number];

type TeamMatch = NonNullable<
	ReturnType<typeof Route.useLoaderData>["team"]
>["appointments"][number];

function formatMatchTime(date: Date | string) {
	return new Date(date).toLocaleTimeString("de-DE", { timeStyle: "short" });
}

function MatchList({ matches }: { matches: TeamMatch[] }) {
	if (matches.length === 0) {
		return (
			<div className="py-8 text-center text-muted-foreground">
				{t("No upcoming matches")}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{matches.map((match) => (
				<AppointmentRow
					key={match.id}
					appointmentId={match.id}
					title={match.title}
					date={match.startDate}
					time={formatMatchTime(match.startDate)}
					location={match.location}
				/>
			))}
		</div>
	);
}

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
	const canEdit = isEditorOrAdmin(user?.role);

	const [isEditing, setIsEditing] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const deleteTeamServerFn = useServerFn(deleteTeam);

	const updateTeamMutation = useMutation({
		fn: updateTeam,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
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
		try {
			const res = await deleteTeamServerFn({
				data: { id: team.id },
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

	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);
	const upcomingMatches = team.appointments.filter(
		(a) => new Date(a.startDate).getTime() >= Date.now(),
	);

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

			<div className="flex flex-col gap-8">
				<Section title={t("Roster")}>
					<div className="overflow-x-auto">
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
				</Section>

				<Section title={t("Standings")}>
					<StandingsTable standings={team.standings} />
				</Section>

				<Section title={t("Next Matches")}>
					<MatchList matches={upcomingMatches} />
				</Section>
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
						defaultValues={{
							clickTTGroupId: team.clickTTGroupId ?? "",
							league: team.league ?? "",
							title: team.title,
						}}
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

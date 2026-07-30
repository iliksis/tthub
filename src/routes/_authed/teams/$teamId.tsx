import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CogIcon, EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deleteTeam, getTeam, updateTeam } from "@/api/teams";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { InternalLink } from "@/components/InternalLink";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { TeamForm } from "@/components/teams/TeamForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ValueCard";
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
		render: (item) => item.name,
		sortable: true,
		sortFn: (a, b) => a.name.localeCompare(b.name),
	},
	{
		key: "ageGroup",
		label: t("Age Group"),
		render: (item) => calculateAgeGroup(item.year),
		sortable: true,
		sortFn: (a, b) =>
			calculateAgeGroup(a.year).localeCompare(calculateAgeGroup(b.year)),
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
			<div className="mb-4 hidden items-center gap-2 lg:flex">
				<span className="text-muted-foreground text-sm">{t("Teams")} /</span>
				<span className="flex-1 font-semibold text-[15px]">{team.title}</span>
				{canEdit && (
					<>
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
					</>
				)}
			</div>

			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<div className="grid grid-cols-4 gap-2">
					<Card title={t("League")} gridRows={3}>
						{team.league}
					</Card>
					<Card title={t("Placement")} gridRows={1}>
						{team.placement}
					</Card>
					<Card title={t("Players")} gridRows={4}>
						<ul>
							{team.players.map((player) => (
								<li key={player.id} className="py-0.5">
									<InternalLink
										to="/players/$playerId"
										params={{ playerId: player.id }}
									>
										{player.name}
									</InternalLink>
								</li>
							))}
						</ul>
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

			{/* Desktop layout: identity header + roster table + rail */}
			<div className="hidden lg:block">
				<div className="mb-6 flex items-center gap-5 rounded-xl bg-gradient-to-br from-muted/60 to-card p-6">
					<div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-xl">
						{team.title.slice(0, 2).toUpperCase()}
					</div>
					<div className="min-w-0 flex-1">
						<div className="font-bold text-xl">{team.title}</div>
						<div className="mt-1 text-muted-foreground text-sm">
							{team.league}
						</div>
					</div>
					<div className="flex shrink-0 gap-3">
						{team.placement && (
							<div className="rounded-lg bg-background/60 px-4 py-2.5 text-center">
								<div className="font-bold text-lg">{team.placement}</div>
								<div className="mt-0.5 text-muted-foreground text-xs">
									{t("Placement")}
								</div>
							</div>
						)}
						<div className="rounded-lg bg-background/60 px-4 py-2.5 text-center">
							<div className="font-bold text-lg">{team.players.length}</div>
							<div className="mt-0.5 text-muted-foreground text-xs">
								{t("Players")}
							</div>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-[1fr_360px] gap-6">
					<div className="min-w-0">
						<h3 className="mb-3 font-bold text-sm">
							{t("Players")}{" "}
							<span className="font-normal text-muted-foreground">
								· {team.players.length}
							</span>
						</h3>
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
					</div>
					<div className="min-w-0 rounded-lg bg-card p-4">
						<h3 className="mb-3 font-bold text-sm">{t("League table")}</h3>
						<Badge variant="secondary" className="mb-2">
							{t("Not available yet")}
						</Badge>
						<p className="text-muted-foreground text-sm">
							{t("League table and fixtures are not available yet.")}
						</p>
					</div>
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

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { getActiveSeason, getSeasons } from "@/api/seasons";
import { getTopLevelTournamentParticipation } from "@/api/stats";
import { getTeams } from "@/api/teams";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { EntitySelect } from "@/components/ui/entity-select";
import { Link } from "@/components/ui/link";
import { m } from "@/paraglide/messages";

const searchSchema = z.object({
	seasonId: z.string().optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/stats")({
	component: RouteComponent,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ seasonId: search.seasonId }),
	loader: async ({ deps }) => {
		const [seasonsRes, activeSeasonRes] = await Promise.all([
			getSeasons(),
			getActiveSeason(),
		]);
		const seasons = seasonsRes.data ?? [];
		const activeSeason = activeSeasonRes.data ?? null;
		const seasonId = deps.seasonId ?? activeSeason?.id;
		const [teamsRes, topLevelParticipationRes] = await Promise.all([
			getTeams({ data: { seasonId } }),
			getTopLevelTournamentParticipation({ data: { seasonId } }),
		]);
		return {
			seasonId,
			seasons,
			teams: teamsRes.data ?? [],
			topLevelParticipation: topLevelParticipationRes.data ?? 0,
		};
	},
	head: () => ({
		meta: [{ title: m.stats_statistics() }],
	}),
});

type TeamRow = ReturnType<typeof Route.useLoaderData>["teams"][number];

const teamColumns: DetailsListColumn<TeamRow>[] = [
	{
		key: "title",
		label: m.common_name(),
		render: (item) => (
			<Link to="/teams/$teamId" params={{ teamId: item.id }}>
				{item.title}
			</Link>
		),
	},
	{
		key: "league",
		label: m.common_league(),
		render: (item) => item.league ?? "—",
	},
	{
		key: "placement",
		label: m.teams_placement(),
		render: (item) =>
			item.placement ? (
				<Badge variant="secondary">{item.placement}</Badge>
			) : (
				"—"
			),
	},
];

function TeamStandingsMobileList({ teams }: { teams: TeamRow[] }) {
	if (teams.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.stats_no_teams_in_this_season()}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{teams.map((team) => (
				<Link
					key={team.id}
					to="/teams/$teamId"
					params={{ teamId: team.id }}
					className="flex w-full items-center justify-between gap-3 border-b border-b-border py-3.5 text-left last:border-b-0"
				>
					<div className="min-w-0 flex-1">
						<div className="min-w-[6ch] truncate font-medium text-sm">
							{team.title}
						</div>
						<div className="truncate text-muted-foreground text-xs">
							{team.league ?? "—"}
						</div>
					</div>
					{team.placement && (
						<Badge variant="secondary" className="shrink-0">
							{team.placement}
						</Badge>
					)}
				</Link>
			))}
		</div>
	);
}

function SeasonSwitcher() {
	const { seasons, seasonId } = Route.useLoaderData();
	const router = useRouter();

	if (seasons.length === 0) return null;

	return (
		<EntitySelect
			items={seasons}
			value={seasonId ?? ""}
			className="w-40"
			onValueChange={(value) => {
				router.navigate({
					search: (prev) => ({ ...prev, seasonId: value || undefined }),
					to: ".",
				});
			}}
		/>
	);
}

function RouteComponent() {
	const { teams, topLevelParticipation } = Route.useLoaderData();

	return (
		<div className="flex flex-col gap-8">
			{/* Mobile: no h1 — the app shell's top bar already shows the page
			 title, matching teams/index.tsx's mobile header. */}
			<div className="flex items-center gap-3 lg:hidden">
				<div className="flex-1" />
				<SeasonSwitcher />
			</div>
			<div className="hidden items-center gap-3 lg:flex">
				<h1 className="flex-1 font-bold text-lg">{m.stats_statistics()}</h1>
				<SeasonSwitcher />
			</div>

			<div className="rounded-lg bg-card p-4">
				<div className="text-muted-foreground text-xs uppercase">
					{m.stats_top_level_tournament_participants()}
				</div>
				<div className="font-bold text-3xl">{topLevelParticipation}</div>
			</div>

			<Section title={m.stats_teams_league_and_placement()}>
				{/* Mobile */}
				<div className="lg:hidden">
					<TeamStandingsMobileList teams={teams} />
				</div>
				{/* Desktop */}
				<div className="hidden overflow-x-auto lg:block">
					<DetailsList
						items={teams}
						getItemId={(item) => item.id}
						columns={teamColumns}
						selectMode="none"
						emptyMessage={m.stats_no_teams_in_this_season()}
					/>
				</div>
			</Section>
		</div>
	);
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { TrophyIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { getActiveSeason, getSeasons } from "@/api/seasons";
import {
	getParticipatingPlayersByTeam,
	getTournamentSeriesPlacements,
	type TournamentSeries,
	type TournamentSeriesNode,
} from "@/api/stats";
import { getTeams } from "@/api/teams";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { Section } from "@/components/Section";
import { Badge } from "@/components/ui/badge";
import { EntitySelect } from "@/components/ui/entity-select";
import { Link } from "@/components/ui/link";
import { formatShortDate } from "@/lib/utils";
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
		const [teamsRes, participatingByTeamRes, tournamentSeriesRes] =
			await Promise.all([
				getTeams({ data: { seasonId } }),
				getParticipatingPlayersByTeam({ data: { seasonId } }),
				getTournamentSeriesPlacements({ data: { seasonId } }),
			]);
		return {
			participatingByTeam: participatingByTeamRes.data ?? [],
			seasonId,
			seasons,
			teams: teamsRes.data ?? [],
			tournamentSeries: tournamentSeriesRes.data ?? [],
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

type ParticipatingRow = ReturnType<
	typeof Route.useLoaderData
>["participatingByTeam"][number];

const participatingColumns: DetailsListColumn<ParticipatingRow>[] = [
	{
		key: "teamTitle",
		label: m.common_name(),
		render: (item) => (
			<Link to="/teams/$teamId" params={{ teamId: item.teamId }}>
				{item.teamTitle}
			</Link>
		),
	},
	{
		align: "right",
		key: "participating",
		label: m.stats_participating_players(),
		render: (item) => `${item.participatingCount}/${item.rosterSize}`,
	},
];

function ParticipatingPlayersMobileList({
	rows,
}: {
	rows: ParticipatingRow[];
}) {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.stats_no_teams_in_this_season()}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{rows.map((row) => (
				<Link
					key={row.teamId}
					to="/teams/$teamId"
					params={{ teamId: row.teamId }}
					className="flex w-full items-center justify-between gap-3 border-b border-b-border py-3.5 text-left last:border-b-0"
				>
					<div className="min-w-[6ch] truncate font-medium text-sm">
						{row.teamTitle}
					</div>
					<div className="shrink-0 text-muted-foreground text-sm">
						{row.participatingCount}/{row.rosterSize}
					</div>
				</Link>
			))}
		</div>
	);
}

// A series' nodes are positioned by generation (how many links removed from
// a root) so branches (multiple previousIds converging into one node) render
// as an actual node-link diagram rather than a straight line. A converging
// node's y-position is the average of its predecessors', matching a
// classic flowchart/git-graph layout.
const FLOW_CARD_W = 168;
const FLOW_CARD_H = 68;
const FLOW_COL_GAP = 56;
const FLOW_ROW_GAP = 16;

function computeGenerations(nodes: TournamentSeriesNode[]) {
	const byId = new Map(nodes.map((n) => [n.appointmentId, n]));
	const cache = new Map<string, number>();
	// `inProgress` guards against a cycle in nextAppointmentId (nothing in the
	// UI prevents an editor from linking two appointments into a loop) —
	// without it, a cycle would recurse forever since `cache` is only
	// populated after a call returns. Revisiting a node still being computed
	// means we're on a cycle; treat it as a root rather than recursing.
	const inProgress = new Set<string>();
	function gen(id: string): number {
		const cached = cache.get(id);
		if (cached !== undefined) return cached;
		const node = byId.get(id);
		if (!node || node.previousIds.length === 0 || inProgress.has(id)) {
			cache.set(id, 0);
			return 0;
		}
		inProgress.add(id);
		const g = Math.max(...node.previousIds.map(gen)) + 1;
		inProgress.delete(id);
		cache.set(id, g);
		return g;
	}
	for (const n of nodes) gen(n.appointmentId);
	return cache;
}

function computeFlowPositions(nodes: TournamentSeriesNode[]) {
	const generations = computeGenerations(nodes);
	const byId = new Map(nodes.map((n) => [n.appointmentId, n]));
	const positions = new Map<string, { x: number; y: number }>();
	const levels: string[][] = [];
	for (const node of nodes) {
		const level = generations.get(node.appointmentId) ?? 0;
		if (!levels[level]) levels[level] = [];
		levels[level].push(node.appointmentId);
	}
	levels.forEach((ids, level) => {
		ids.forEach((id, index) => {
			const node = byId.get(id);
			const predecessorYs = (node?.previousIds ?? [])
				.map((pid) => positions.get(pid)?.y)
				.filter((y): y is number => y !== undefined);
			const y =
				predecessorYs.length > 0
					? predecessorYs.reduce((a, b) => a + b, 0) / predecessorYs.length
					: index * (FLOW_CARD_H + FLOW_ROW_GAP);
			positions.set(id, { x: level * (FLOW_CARD_W + FLOW_COL_GAP), y });
		});
	});
	return positions;
}

function SeriesNodePlacements({ node }: { node: TournamentSeriesNode }) {
	if (node.categories.length === 0) {
		return (
			<p className="text-muted-foreground text-xs">
				{m.placements_no_participants_yet()}
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{node.categories.map((group) => (
				<div key={group.category}>
					<div className="mb-1.5 text-muted-foreground text-[11px] uppercase tracking-wide">
						{group.category}
					</div>
					<div className="flex flex-col gap-0.5">
						{group.placements.map((p) => (
							<div
								key={p.playerId}
								className="flex items-center justify-between rounded-md px-1.5 py-1 text-xs hover:bg-accent/50"
							>
								<Link to="/players/$playerId" params={{ playerId: p.playerId }}>
									{p.playerName}
								</Link>
								{p.placement ? (
									<span className="font-medium text-primary">
										{p.placement}
									</span>
								) : (
									<span className="text-muted-foreground italic">
										{m.placements_pending()}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function SeriesFlowCard({ series }: { series: TournamentSeries }) {
	const { positions, maxX, maxY } = useMemo(() => {
		const computed = computeFlowPositions(series.nodes);
		const xs = [...computed.values()].map((p) => p.x);
		const ys = [...computed.values()].map((p) => p.y);
		return {
			maxX: (xs.length > 0 ? Math.max(...xs) : 0) + FLOW_CARD_W,
			maxY: (ys.length > 0 ? Math.max(...ys) : 0) + FLOW_CARD_H,
			positions: computed,
		};
	}, [series.nodes]);
	const defaultSelectedId =
		series.nodes.find((n) => n.isCurrent)?.appointmentId ??
		series.nodes[0]?.appointmentId ??
		"";
	const [selectedId, setSelectedId] = useState(defaultSelectedId);
	const selectedNode = series.nodes.find((n) => n.appointmentId === selectedId);

	return (
		<div className="rounded-xl border border-border bg-card p-4 shadow-sm">
			<div
				className="relative overflow-x-auto pb-1"
				style={{ minHeight: maxY }}
			>
				<svg
					className="pointer-events-none absolute top-0 left-0"
					width={maxX}
					height={maxY}
					aria-hidden="true"
				>
					<title>{`${m.stats_tournament_series_and_placements()} – ${series.nodes[0]?.title ?? ""}`}</title>
					{series.nodes
						.filter((n) => n.nextId)
						.map((n) => {
							const from = positions.get(n.appointmentId);
							const to = n.nextId ? positions.get(n.nextId) : undefined;
							if (!from || !to) return null;
							const x1 = from.x + FLOW_CARD_W;
							const y1 = from.y + FLOW_CARD_H / 2;
							const x2 = to.x;
							const y2 = to.y + FLOW_CARD_H / 2;
							const c = FLOW_COL_GAP / 2;
							return (
								<path
									key={n.appointmentId}
									d={`M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`}
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									className="text-border"
								/>
							);
						})}
				</svg>
				<div className="relative" style={{ height: maxY, width: maxX }}>
					{series.nodes.map((node) => {
						const pos = positions.get(node.appointmentId);
						if (!pos) return null;
						return (
							<button
								key={node.appointmentId}
								type="button"
								onClick={() => setSelectedId(node.appointmentId)}
								data-current={node.isCurrent || undefined}
								data-selected={selectedId === node.appointmentId || undefined}
								className="absolute rounded-xl border border-border bg-background p-2.5 text-left shadow-sm transition-[box-shadow,border-color] hover:border-primary/40 data-[current]:border-primary/60 data-[selected]:ring-2 data-[selected]:ring-primary/40"
								style={{
									height: FLOW_CARD_H,
									left: pos.x,
									top: pos.y,
									width: FLOW_CARD_W,
								}}
							>
								<div className="flex items-center justify-between gap-1">
									<TrophyIcon
										className={`size-3.5 shrink-0 ${node.isCurrent ? "text-primary" : "text-muted-foreground"}`}
									/>
									{node.isCurrent && (
										<span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-[9px] text-primary uppercase">
											{m.stats_this_season()}
										</span>
									)}
								</div>
								<div className="mt-1 truncate font-semibold text-xs">
									{node.title}
								</div>
								<div className="truncate text-muted-foreground text-[11px]">
									{node.seasonLabel}
								</div>
							</button>
						);
					})}
				</div>
			</div>
			{selectedNode && (
				<div className="mt-4 rounded-lg bg-background p-3">
					<Link
						to="/appts/$apptId"
						params={{ apptId: selectedNode.appointmentId }}
						className="font-medium text-sm"
					>
						{selectedNode.title}
					</Link>
					<div className="mb-2 text-muted-foreground text-xs">
						{m.common_season()} {selectedNode.seasonLabel} ·{" "}
						{formatShortDate(selectedNode.date)}
					</div>
					<SeriesNodePlacements node={selectedNode} />
				</div>
			)}
		</div>
	);
}

function TournamentSeriesList({ series }: { series: TournamentSeries[] }) {
	if (series.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.stats_no_tournaments_in_this_season()}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{series.map((s) => (
				<SeriesFlowCard key={s.seriesId} series={s} />
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
	const { teams, participatingByTeam, tournamentSeries } =
		Route.useLoaderData();

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

			<Section title={m.stats_participating_players()}>
				{/* Mobile */}
				<div className="lg:hidden">
					<ParticipatingPlayersMobileList rows={participatingByTeam} />
				</div>
				{/* Desktop */}
				<div className="hidden overflow-x-auto lg:block">
					<DetailsList
						items={participatingByTeam}
						getItemId={(item) => item.teamId}
						columns={participatingColumns}
						selectMode="none"
						emptyMessage={m.stats_no_teams_in_this_season()}
					/>
				</div>
			</Section>

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

			<Section title={m.stats_tournament_series_and_placements()}>
				<TournamentSeriesList series={tournamentSeries} />
			</Section>
		</div>
	);
}

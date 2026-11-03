import { colorLegend, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { getActiveSeason, getSeasons } from "@/api/seasons";
import {
	getPlayerCountOverSeasons,
	getRosterBreakdown,
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
import { cn, formatShortDate } from "@/lib/utils";
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
		const [teamsRes, playerCountRes, rosterBreakdownRes, tournamentSeriesRes] =
			await Promise.all([
				getTeams({ data: { seasonId } }),
				getPlayerCountOverSeasons(),
				getRosterBreakdown(),
				getTournamentSeriesPlacements({ data: { seasonId } }),
			]);
		return {
			playerCounts: playerCountRes.data ?? [],
			rosterBreakdown: rosterBreakdownRes.data ?? { rows: [], total: 0 },
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

type PlayerCountRow = ReturnType<
	typeof Route.useLoaderData
>["playerCounts"][number];

// One entry per line in the chart and per count column in the table, so adding
// a series is a single edit here.
const PLAYER_COUNT_SERIES = [
	{
		color: "hsl(var(--primary))",
		key: "playerCount",
		label: () => m.stats_player_count_total(),
	},
	{
		color: "hsl(var(--info))",
		key: "maleCount",
		label: () => m.stats_player_count_male(),
	},
	{
		color: "hsl(var(--chart-1))",
		key: "femaleCount",
		label: () => m.stats_player_count_female(),
	},
] as const;

const playerCountColumns: DetailsListColumn<PlayerCountRow>[] = [
	{
		key: "seasonName",
		label: m.common_name(),
		render: (item) => item.seasonName,
	},
	...PLAYER_COUNT_SERIES.map(
		(series): DetailsListColumn<PlayerCountRow> => ({
			align: "right",
			key: series.key,
			label: series.label(),
			render: (item) => item[series.key],
		}),
	),
];

function PlayerCountChart({ rows }: { rows: PlayerCountRow[] }) {
	// Rebuilt only when the data changes: `defineChart` compiles the scales and
	// marks, so doing it on every render (e.g. each hover-driven parent update)
	// would be wasted work.
	const definition = useMemo(() => {
		const points = rows.flatMap((row) =>
			PLAYER_COUNT_SERIES.map((series) => ({
				count: row[series.key],
				id: `${row.seasonId}-${series.key}`,
				season: row.seasonName,
				series: series.label(),
			})),
		);

		return defineChart({
			color: {
				legend: colorLegend(),
				scale: () =>
					scaleOrdinal<string, string>()
						.domain(PLAYER_COUNT_SERIES.map((series) => series.label()))
						.range(PLAYER_COUNT_SERIES.map((series) => series.color)),
			},
			// One tooltip per season listing every series, instead of one per line.
			focus: "group-x",
			marks: [
				lineY(points, {
					key: "id",
					points: true,
					strokeWidth: 2,
					x: "season",
					y: "count",
					z: "series",
				}),
			],
			// The x axis has one point per season, so the pointer is usually far
			// from any point horizontally; without this the group would clear
			// (default: 48px) and the tooltip would only show right on a dot.
			maxFocusDistance: Number.POSITIVE_INFINITY,
			scales: {
				x: { scale: () => scalePoint<string>().padding(0.4) },
				y: { grid: true, nice: true, scale: scaleLinear },
			},
			tooltip,
		});
	}, [rows]);

	if (rows.length === 0) return null;

	return (
		<Chart
			definition={definition}
			// The tooltip's default chrome is a light card; these CSS variables
			// (read from the chart container) restyle it with the app's popover
			// tokens so it follows the light/dark theme.
			className="[--ts-chart-tooltip-background:var(--color-popover)] [--ts-chart-tooltip-border:1px_solid_var(--color-border)] [--ts-chart-tooltip-color:var(--color-popover-foreground)]"
			height={240}
			ariaLabel={m.stats_player_count_over_seasons()}
		/>
	);
}

type RosterBreakdownRow = ReturnType<
	typeof Route.useLoaderData
>["rosterBreakdown"]["rows"][number];

const rosterBreakdownColumns: DetailsListColumn<RosterBreakdownRow>[] = [
	{
		key: "ageGroup",
		label: m.stats_roster_age_group(),
		render: (item) => item.ageGroup,
	},
	{
		align: "right",
		key: "male",
		label: m.stats_player_count_male(),
		render: (item) => item.male,
	},
	{
		align: "right",
		key: "female",
		label: m.stats_player_count_female(),
		render: (item) => item.female,
	},
	{
		align: "right",
		key: "unknown",
		label: m.stats_roster_unknown(),
		render: (item) => item.unknown,
	},
];

function RosterBreakdownSection({
	rosterBreakdown,
}: {
	rosterBreakdown: ReturnType<typeof Route.useLoaderData>["rosterBreakdown"];
}) {
	return (
		<Section
			title={m.stats_roster_breakdown()}
			description={m.stats_roster_breakdown_description()}
		>
			{rosterBreakdown.total === 0 ? (
				<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
					{m.stats_no_rostered_players()}
				</div>
			) : (
				<div className="overflow-x-auto">
					<DetailsList
						items={rosterBreakdown.rows}
						getItemId={(item) => item.ageGroup}
						columns={rosterBreakdownColumns}
						selectMode="none"
					/>
				</div>
			)}
		</Section>
	);
}

function PlayerCountMobileList({ rows }: { rows: PlayerCountRow[] }) {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.stats_no_seasons()}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{rows.map((row) => (
				<div
					key={row.seasonId}
					className="flex w-full items-center justify-between gap-3 border-b border-b-border py-3.5 last:border-b-0"
				>
					<div className="min-w-[6ch] truncate font-medium text-sm">
						{row.seasonName}
					</div>
					<div className="shrink-0 text-muted-foreground text-sm">
						{m.stats_player_count_summary({
							param1: row.playerCount,
							param2: row.maleCount,
							param3: row.femaleCount,
						})}
					</div>
				</div>
			))}
		</div>
	);
}

// A series is laid out by generation (how many links removed from a root) so
// branches (multiple previousIds converging into one node) read as a small
// bracket. The list beside it is newest-first, so the tree is too: the latest
// generation is on top and earlier ones hang below it. It is nearly always
// only one or two nodes wide, so the diagram stays narrow. A converging node
// sits at the average x of its predecessors, like a classic flowchart.
const TREE_LEVEL_GAP = 84;
const TREE_SIBLING_GAP = 128;
const TREE_DOT_PAD = 12;
const TREE_LABEL_WIDTH = 104;
const TREE_LABEL_MAX_CHARS = 32;
const TREE_DOT_RADIUS = 5;

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

function computeTreePositions(nodes: TournamentSeriesNode[]) {
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
			const predecessorXs = (byId.get(id)?.previousIds ?? [])
				.map((pid) => positions.get(pid)?.x)
				.filter((x): x is number => x !== undefined);
			const x =
				predecessorXs.length > 0
					? predecessorXs.reduce((a, b) => a + b, 0) / predecessorXs.length
					: index * TREE_SIBLING_GAP;
			positions.set(id, { x, y: (levels.length - 1 - level) * TREE_LEVEL_GAP });
		});
	});
	return positions;
}

function SeriesTree({ series }: { series: TournamentSeries }) {
	const positions = computeTreePositions(series.nodes);
	const xs = [...positions.values()].map((p) => p.x);
	const ys = [...positions.values()].map((p) => p.y);
	const width =
		(xs.length > 0 ? Math.max(...xs) : 0) + TREE_DOT_PAD + TREE_LABEL_WIDTH;
	const height = (ys.length > 0 ? Math.max(...ys) : 0) + 2 * TREE_DOT_PAD;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`${-TREE_DOT_PAD} ${-TREE_DOT_PAD} ${width} ${height}`}
			className="max-w-full overflow-visible"
			role="img"
		>
			<title>{`${m.stats_tournament_series_and_placements()} – ${series.nodes[0]?.title ?? ""}`}</title>
			{series.nodes
				.filter((n) => n.nextId)
				.map((n) => {
					const from = positions.get(n.appointmentId);
					const to = n.nextId ? positions.get(n.nextId) : undefined;
					if (!from || !to) return null;
					const c = TREE_LEVEL_GAP / 2;
					return (
						<path
							key={n.appointmentId}
							d={`M ${from.x} ${from.y - TREE_DOT_RADIUS} C ${from.x} ${from.y - c}, ${to.x} ${to.y + c}, ${to.x} ${to.y + TREE_DOT_RADIUS}`}
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							className="text-border"
						/>
					);
				})}
			{series.nodes.map((node) => {
				const pos = positions.get(node.appointmentId);
				if (!pos) return null;
				return (
					<g
						key={node.appointmentId}
						transform={`translate(${pos.x}, ${pos.y})`}
					>
						<title>{node.title}</title>
						<circle
							cx={0}
							cy={0}
							r={TREE_DOT_RADIUS}
							strokeWidth={node.isCurrent ? 0 : 1.5}
							className={
								node.isCurrent
									? "fill-primary"
									: "fill-background stroke-border"
							}
						/>
						<text
							x={TREE_DOT_RADIUS + 7}
							y={4}
							className={`text-[11px] ${node.isCurrent ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}
						>
							{node.title.length > TREE_LABEL_MAX_CHARS
								? `${node.title.slice(0, TREE_LABEL_MAX_CHARS - 1)}…`
								: node.title}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

// A fixed-width rank column leads each row so rank and name stay paired on
// wide screens — a full-width justify-between row stretched them apart.
function SeriesPlacementRow({
	placement,
	playerId,
	playerName,
}: {
	placement: string | null;
	playerId: string;
	playerName: string;
}) {
	return (
		<div className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-2 py-1">
			{placement ? (
				<span className="text-right font-medium text-primary text-sm tabular-nums">
					{placement}
				</span>
			) : (
				<span className="text-right text-muted-foreground text-xs">
					<span aria-hidden="true">–</span>
					<span className="sr-only">{m.placements_pending()}</span>
				</span>
			)}
			<Link
				to="/players/$playerId"
				params={{ playerId }}
				className="truncate text-sm"
			>
				{playerName}
			</Link>
		</div>
	);
}

function SeriesNodeResults({ node }: { node: TournamentSeriesNode }) {
	return (
		<article>
			<div className="flex flex-wrap items-baseline gap-2">
				<Link
					to="/appts/$apptId"
					params={{ apptId: node.appointmentId }}
					className="font-medium text-sm"
				>
					{node.title}
				</Link>
				{node.isCurrent && (
					<span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase">
						{m.stats_this_season()}
					</span>
				)}
			</div>
			<div className="mb-1.5 text-muted-foreground text-xs">
				{m.common_season()} {node.seasonLabel} · {formatShortDate(node.date)}
			</div>
			{node.categories.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					{m.placements_no_participants_yet()}
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{node.categories.map((group) => (
						<div key={group.category}>
							<div className="mb-1 text-[11px] text-muted-foreground uppercase tracking-wide">
								{group.category}
							</div>
							{group.placements.map((p) => (
								<SeriesPlacementRow
									key={p.playerId}
									placement={p.placement}
									playerId={p.playerId}
									playerName={p.playerName}
								/>
							))}
						</div>
					))}
				</div>
			)}
		</article>
	);
}

function seriesTabLabel(series: TournamentSeries) {
	return (
		series.nodes.find((n) => n.isCurrent)?.title ?? series.nodes[0]?.title ?? ""
	);
}

function TournamentSeriesList({ series }: { series: TournamentSeries[] }) {
	const [activeId, setActiveId] = useState(series[0]?.seriesId ?? "");

	if (series.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.stats_no_tournaments_in_this_season()}
			</div>
		);
	}

	const active = series.find((s) => s.seriesId === activeId) ?? series[0];

	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-6",
				series.length > 1 && "lg:grid-cols-[13rem_minmax(0,1fr)]",
			)}
		>
			{series.length > 1 && (
				<div
					role="tablist"
					aria-label={m.stats_tournament_series_and_placements()}
					aria-orientation="vertical"
					className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible lg:border-r lg:border-r-border lg:pr-4"
				>
					{series.map((s) => (
						<button
							key={s.seriesId}
							type="button"
							role="tab"
							aria-selected={s.seriesId === active.seriesId}
							onClick={() => setActiveId(s.seriesId)}
							className={cn(
								"shrink-0 rounded-md px-3 py-2 text-left font-medium text-sm transition-colors",
								s.seriesId === active.seriesId
									? "bg-primary/10 text-primary"
									: "text-muted-foreground hover:text-foreground lg:border-l-transparent",
							)}
						>
							{seriesTabLabel(s)}
							<span className="block font-normal text-[11px] text-muted-foreground">
								{m.stats_tournament_count({ count: s.nodes.length })}
							</span>
						</button>
					))}
				</div>
			)}
			<div role="tabpanel" className="flex gap-8 lg:flex-row lg:items-start">
				<div className="flex min-w-0 flex-1 flex-col gap-5">
					{active.nodes.map((node) => (
						<SeriesNodeResults key={node.appointmentId} node={node} />
					))}
				</div>
				<div className="hidden lg:flex shrink-0 justify-center lg:w-64">
					<SeriesTree series={active} />
				</div>
			</div>
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
	const { teams, playerCounts, rosterBreakdown, tournamentSeries } =
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

			<Section title={m.stats_player_count_over_seasons()}>
				<PlayerCountChart rows={playerCounts} />
				{/* Mobile */}
				<div className="lg:hidden">
					<PlayerCountMobileList rows={playerCounts} />
				</div>
				{/* Desktop */}
				<div className="hidden overflow-x-auto lg:block">
					<DetailsList
						items={playerCounts}
						getItemId={(item) => item.seasonId}
						columns={playerCountColumns}
						selectMode="none"
						emptyMessage={m.stats_no_seasons()}
					/>
				</div>
			</Section>

			<RosterBreakdownSection rosterBreakdown={rosterBreakdown} />

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

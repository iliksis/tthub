import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { getActiveSeason, getSeasons } from "@/api/seasons";
import { getTeams } from "@/api/teams";
import { CreateTeam } from "@/components/teams/CreateTeam";
import { List } from "@/components/teams/List";
import { TeamsSplitView } from "@/components/teams/TeamsSplitView";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/text";

const searchSchema = z.object({
	seasonId: z.string().optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/teams/")({
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
		const res = await getTeams({ data: { seasonId } });
		return { activeSeason, seasonId, seasons, teams: res.data ?? [] };
	},
	head: () => ({
		meta: [{ title: t("Teams") }],
	}),
});

function SeasonSwitcher() {
	const { seasons, seasonId } = Route.useLoaderData();
	const router = useRouter();

	if (seasons.length === 0) return null;

	return (
		<Select
			items={Object.fromEntries(seasons.map((s) => [s.id, s.name]))}
			value={seasonId ?? ""}
			onValueChange={(value) => {
				router.navigate({
					search: (prev) => ({ ...prev, seasonId: value || undefined }),
					to: ".",
				});
			}}
		>
			<SelectTrigger className="w-40">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{seasons.map((season) => (
					<SelectItem key={season.id} value={season.id}>
						{season.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function RouteComponent() {
	const { teams, seasons, activeSeason } = Route.useLoaderData();

	if (!teams) return <div>{t("An Error occurred")}</div>;

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<div className="mb-3 flex items-center gap-2">
					<SeasonSwitcher />
					<CreateTeam seasons={seasons} activeSeasonId={activeSeason?.id} />
				</div>
				<List teams={teams} />
			</div>

			{/* Desktop layout: master-detail split view */}
			<div className="hidden lg:flex lg:flex-col lg:gap-4">
				<div className="flex items-center gap-3">
					<h1 className="flex-1 font-bold text-lg">
						{t("Teams")}{" "}
						<span className="font-normal text-muted-foreground text-sm">
							· {teams.length}
						</span>
					</h1>
					<SeasonSwitcher />
					<CreateTeam seasons={seasons} activeSeasonId={activeSeason?.id} />
				</div>
				<TeamsSplitView teams={teams} />
			</div>
		</>
	);
}

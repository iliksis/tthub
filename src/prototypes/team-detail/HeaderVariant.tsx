import { EditIcon, Trash2Icon, TrophyIcon, UsersIcon } from "lucide-react";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";
import {
	type PrototypePlayer,
	type TeamVariantProps,
	teamStats,
} from "./types";

const columns: DetailsListColumn<PrototypePlayer>[] = [
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

const StatTile = ({ label, value }: { label: string; value: string }) => (
	<div className="flex-1 rounded-xl bg-card p-4">
		<div className="mb-1 text-muted-foreground text-xs uppercase">{label}</div>
		<div className="font-bold text-lg">{value}</div>
	</div>
);

// Axis: layout — full-width dashboard header (title + actions in one row) with a
// stat-tile strip beneath, matching the page-header pattern used on list pages
// (appts/index) rather than the sidebar pattern used on the player page.
export function HeaderVariant({
	team,
	canEdit,
	onEdit,
	onDelete,
	onPlayerClick,
}: TeamVariantProps) {
	const stats = teamStats(team);
	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);

	return (
		<div className="flex flex-col gap-4 lg:gap-6">
			<div className="flex flex-wrap items-center gap-3">
				<div>
					<h1 className="font-bold text-lg">{team.title}</h1>
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						{team.league ?? t("No league set")}
						{team.placement && (
							<Badge variant="secondary">
								{t("Placement")} {team.placement}
							</Badge>
						)}
					</div>
				</div>
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
							onClick={onDelete}
						>
							<Trash2Icon className="size-4" />
							{t("Delete team")}
						</Button>
					</div>
				)}
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatTile label={t("Players")} value={String(stats.playerCount)} />
				<StatTile
					label={t("QTTR")}
					value={stats.avgQttr ? String(stats.avgQttr) : "–"}
				/>
				<StatTile
					label={t("Age Group")}
					value={
						stats.youngestYear ? calculateAgeGroup(stats.youngestYear) : "–"
					}
				/>
				<StatTile label={t("Placement")} value={team.placement ?? "–"} />
			</div>

			<div className="rounded-lg bg-card">
				<div className="flex items-center justify-between border-border/60 border-b px-4 py-3">
					<h3 className="font-bold text-sm">
						{t("Players")}{" "}
						<span className="font-normal text-muted-foreground">
							· {team.players.length}
						</span>
					</h3>
				</div>
				{sortedPlayers.length === 0 ? (
					<div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
						<UsersIcon className="size-5" />
						{t("No items found")}
					</div>
				) : (
					<DetailsList
						items={sortedPlayers}
						getItemId={(item) => item.id}
						columns={columns}
						selectMode="none"
						onItemClick={(item) => onPlayerClick(item.id)}
					/>
				)}
			</div>

			<div className="flex items-center gap-3 rounded-lg border border-border/60 border-dashed p-4 text-muted-foreground text-sm">
				<TrophyIcon className="size-4 shrink-0" />
				{t("League table and fixtures are not available yet.")}
			</div>
		</div>
	);
}

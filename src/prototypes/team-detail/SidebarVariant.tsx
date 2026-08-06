import { EditIcon, Trash2Icon, UsersIcon } from "lucide-react";
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

// Axis: layout — mirrors the sticky identity rail already used on the player detail page,
// so both detail pages share the same visual grammar.
export function SidebarVariant({
	team,
	canEdit,
	onEdit,
	onDelete,
	onPlayerClick,
}: TeamVariantProps) {
	const stats = teamStats(team);
	const sortedPlayers = [...team.players].sort((a, b) => b.qttr - a.qttr);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr] lg:items-start lg:gap-6">
			<div className="flex flex-col items-center rounded-xl bg-card p-6 text-center lg:sticky lg:top-6">
				<div className="font-bold text-lg">{team.title}</div>
				<div className="mb-4 text-muted-foreground text-sm">
					{team.league ?? t("No league set")}
				</div>
				{team.placement && (
					<Badge variant="secondary" className="mb-4">
						{t("Placement")} {team.placement}
					</Badge>
				)}
				<div className="mb-4 flex w-full gap-2">
					<div className="flex-1 rounded-md bg-muted/50 p-3 text-left">
						<div className="mb-1 text-muted-foreground text-xs">
							{t("Players")}
						</div>
						<div className="font-semibold text-sm">{stats.playerCount}</div>
					</div>
					<div className="flex-1 rounded-md bg-muted/50 p-3 text-left">
						<div className="mb-1 text-muted-foreground text-xs">
							{t("QTTR")}
						</div>
						<div className="font-semibold text-success text-sm">
							{stats.avgQttr || "–"}
						</div>
					</div>
				</div>
				{canEdit && (
					<div className="flex w-full gap-2">
						<Button
							variant="outline"
							size="sm"
							className="flex-1"
							title={t("Update team")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							title={t("Delete team")}
							onClick={onDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}
			</div>

			<div className="min-w-0 rounded-xl bg-card">
				{sortedPlayers.length === 0 ? (
					<div className="flex flex-col items-center gap-2 rounded-xl bg-card p-8 text-center text-muted-foreground">
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
		</div>
	);
}

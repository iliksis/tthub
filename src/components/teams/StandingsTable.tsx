import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Standing } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

type StandingsTableProps = {
	standings: Standing[];
	ownTeamName?: string;
};

export function StandingsTable({
	standings,
	ownTeamName,
}: StandingsTableProps) {
	if (standings.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No standings imported yet.")}
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className="text-right">{t("Rank")}</TableHead>
					<TableHead>{t("Team")}</TableHead>
					<TableHead className="text-right">S</TableHead>
					<TableHead className="text-right">U</TableHead>
					<TableHead className="text-right">N</TableHead>
					<TableHead className="text-right">{t("Matches")}</TableHead>
					<TableHead className="text-right">{t("Points")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{standings.map((standing) => (
					<TableRow
						key={standing.id}
						className={cn(standing.teamName === ownTeamName && "bg-muted/50")}
					>
						<TableCell className="text-right">{standing.rank}</TableCell>
						<TableCell>{standing.teamName}</TableCell>
						<TableCell className="text-right">{standing.wins}</TableCell>
						<TableCell className="text-right">{standing.undecided}</TableCell>
						<TableCell className="text-right">{standing.losses}</TableCell>
						<TableCell className="text-right">
							{standing.matchesWon}:{standing.matchesLost}
						</TableCell>
						<TableCell className="text-right">
							{standing.pointsWon}:{standing.pointsLost}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

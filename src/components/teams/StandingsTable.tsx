import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Standing } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";

type StandingsTableProps = {
	standings: Standing[];
};

export function StandingsTable({ standings }: StandingsTableProps) {
	if (standings.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.common_no_standings_imported_yet()}
			</div>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow className="hover:bg-transparent">
					<TableHead className="w-px text-right">{m.teams_rank()}</TableHead>
					<TableHead>{m.common_team()}</TableHead>
					<TableHead className="hidden text-right sm:table-cell">S</TableHead>
					<TableHead className="hidden text-right sm:table-cell">U</TableHead>
					<TableHead className="hidden text-right sm:table-cell">N</TableHead>
					<TableHead className="text-right">{m.teams_matches()}</TableHead>
					<TableHead className="text-right">{m.teams_points()}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{standings.map((standing) => (
					<TableRow key={standing.id} className="hover:bg-background">
						<TableCell className="w-px text-right">{standing.rank}</TableCell>
						<TableCell className="max-w-0 truncate">
							{standing.teamName}
						</TableCell>
						<TableCell className="hidden text-right sm:table-cell">
							{standing.wins}
						</TableCell>
						<TableCell className="hidden text-right sm:table-cell">
							{standing.undecided}
						</TableCell>
						<TableCell className="hidden text-right sm:table-cell">
							{standing.losses}
						</TableCell>
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

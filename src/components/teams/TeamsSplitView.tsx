import { Loader2Icon } from "lucide-react";
import React from "react";
import { DetailsList } from "@/components/DetailsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/components/ui/link";
import { TableRow } from "@/components/ui/table";
import { useTeamDetail } from "@/hooks/useTeamDetail";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { TeamPreview } from "./TeamPreview";
import type { TeamRow } from "./TeamSummary";

export const TeamsSplitView = ({ teams }: { teams: TeamRow[] }) => {
	const [selectedId, setSelectedId] = React.useState<string | undefined>(
		teams[0]?.id,
	);
	const { team, isLoading, isError } = useTeamDetail(selectedId);

	if (teams.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.common_no_teams_found()}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px] lg:gap-8">
			<div className="min-w-0 overflow-x-auto">
				<DetailsList
					columns={[
						{
							key: "name",
							label: m.common_name(),
							render: (item) => (
								<Link
									to="/teams/$teamId"
									params={{ teamId: item.id }}
									onClick={(e) => e.stopPropagation()}
								>
									{item.title}
								</Link>
							),
						},
						{
							key: "league",
							label: m.common_league(),
							render: (item) => item.league,
						},
						{
							key: "placement",
							label: m.teams_placement(),
							render: (item) => item.placement,
						},
						{
							align: "right",
							key: "players",
							label: m.common_players(),
							render: (item) => item._count.players,
						},
					]}
					getItemId={(item) => item.id}
					items={teams}
					onRenderRow={(item, children) => (
						<TableRow
							key={item.id}
							className={cn(
								"h-10 cursor-pointer",
								item.id === selectedId && "bg-muted",
							)}
							onClick={() => setSelectedId(item.id)}
						>
							{children}
						</TableRow>
					)}
					selectMode="none"
				/>
			</div>
			<div className="min-w-0 lg:sticky lg:top-6 lg:border-border/60 lg:border-l lg:pl-8">
				{!selectedId ? (
					<div className="text-muted-foreground text-sm">
						{m.common_select_a_row_to_see_details()}
					</div>
				) : isError ? (
					<Alert variant="destructive">
						<AlertDescription>
							{m.teams_team_could_not_be_loaded()}
						</AlertDescription>
					</Alert>
				) : isLoading || !team ? (
					<div className="flex items-center justify-center py-8">
						<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : (
					<TeamPreview team={team} />
				)}
			</div>
		</div>
	);
};

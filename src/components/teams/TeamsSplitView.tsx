import { Loader2Icon } from "lucide-react";
import React from "react";
import { DetailsList } from "@/components/DetailsList";
import { Link } from "@/components/ui/link";
import { TableRow } from "@/components/ui/table";
import { useTeamDetail } from "@/hooks/useTeamDetail";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
import { TeamPreview } from "./TeamPreview";

type TeamRow = Team & { _count: { players: number } };

export const TeamsSplitView = ({ teams }: { teams: TeamRow[] }) => {
	const [selectedId, setSelectedId] = React.useState<string | undefined>(
		teams[0]?.id,
	);
	const { team, isLoading } = useTeamDetail(selectedId);

	if (teams.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No teams found")}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[1fr_360px] items-start gap-4">
			<div className="min-w-0 overflow-x-auto rounded-lg bg-card">
				<DetailsList
					columns={[
						{
							key: "name",
							label: t("Name"),
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
							label: t("League"),
							render: (item) => item.league,
						},
						{
							key: "placement",
							label: t("Placement"),
							render: (item) => item.placement,
						},
						{
							align: "right",
							key: "players",
							label: t("Players"),
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
			<div className="min-w-0 rounded-lg bg-card p-5 lg:sticky lg:top-6">
				{!selectedId ? (
					<div className="text-muted-foreground text-sm">
						{t("Select a row to see details")}
					</div>
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

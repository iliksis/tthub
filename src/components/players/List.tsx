import { useRouter } from "@tanstack/react-router";
import { DetailsList } from "@/components/DetailsList";
import { TeamHalfBadge } from "@/components/teams/TeamSummary";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";
import type { Player, Team, TeamPlayer } from "@/lib/prisma/client";
import {
	calculateAgeGroup,
	createColorForUserId,
	shortenUserName,
} from "@/lib/utils";
import { m } from "@/paraglide/messages";

type ListProps = {
	players: (Player & { teams: (TeamPlayer & { team: Team })[] })[];
	showFlags?: boolean;
};
type ListPlayer = ListProps["players"][number];
export const List = ({ players, showFlags = false }: ListProps) => {
	const router = useRouter();
	if (players.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{m.common_no_players_found()}
			</div>
		);
	}

	const onClickPlayer = async (id: string) => {
		await router.navigate({
			params: { playerId: id },
			to: "/players/$playerId",
		});
	};

	return (
		<div className="min-w-0 overflow-x-auto">
			<DetailsList
				items={players}
				columns={[
					{
						key: "name",
						label: m.common_name(),
						render: (item) => {
							const color = createColorForUserId(item.id);
							return (
								<div className="flex items-center gap-2.5">
									<Avatar size="sm" className="shrink-0">
										<AvatarFallback
											style={{
												backgroundColor: color.backgroundColor,
												color: color.foregroundColor,
											}}
										>
											{shortenUserName(item.name)}
										</AvatarFallback>
									</Avatar>
									<Link
										to="/players/$playerId"
										params={{ playerId: item.id }}
										onClick={(e) => e.stopPropagation()}
										className="font-medium"
									>
										{item.name}
									</Link>
									{showFlags && item.isClubMember && (
										<Badge variant="outline">{m.players_member_badge()}</Badge>
									)}
								</div>
							);
						},
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "ageGroup",
						label: m.common_age_group(),
						render: (item) => (
							<span className="text-muted-foreground">
								{calculateAgeGroup(item.year)}{" "}
								<span className="text-xs">· {item.year}</span>
							</span>
						),
						sortable: true,
						sortFn: (a, b) =>
							calculateAgeGroup(a.year).localeCompare(
								calculateAgeGroup(b.year),
							),
					},
					{
						align: "right",
						key: "qttr",
						label: m.common_qttr(),
						render: (item) => (
							<span className="font-semibold tabular-nums">{item.qttr}</span>
						),
						sortable: true,
						sortFn: (a, b) => a.qttr - b.qttr,
					},
					{
						key: "team",
						label: m.common_team(),
						render: (item) => {
							const team = item.teams[0]?.team;
							return (
								team && (
									<div className="flex items-center gap-1.5 text-muted-foreground">
										<Link
											to="/teams/$teamId"
											params={{ teamId: team.id }}
											onClick={(e) => e.stopPropagation()}
											className="text-foreground"
										>
											{team.title}
										</Link>
										<TeamHalfBadge half={team.half} />
										{team.league && <span>· {team.league}</span>}
									</div>
								)
							);
						},
						sortable: true,
						sortFn: (a, b) => {
							const teamA = a.teams[0]?.team.title || "";
							const teamB = b.teams[0]?.team.title || "";
							return teamA.localeCompare(teamB);
						},
					},
					...(showFlags
						? [
								{
									key: "eligible",
									label: m.players_eligible_to_play(),
									render: (item: ListPlayer) => (
										<span className="text-muted-foreground">
											{item.isEligibleToPlay ? m.players_yes() : m.players_no()}
										</span>
									),
									sortable: true,
									sortFn: (a: ListPlayer, b: ListPlayer) =>
										Number(a.isEligibleToPlay) - Number(b.isEligibleToPlay),
								},
							]
						: []),
				]}
				getItemId={(item) => item.id}
				selectMode="none"
				onItemClick={(item) => onClickPlayer(item.id)}
			/>
		</div>
	);
};

import { useRouter } from "@tanstack/react-router";
import { DetailsList } from "@/components/DetailsList";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "@/components/ui/link";
import type { Player, Team, TeamPlayer } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import {
	calculateAgeGroup,
	createColorForUserId,
	shortenUserName,
} from "@/lib/utils";

type ListProps = {
	players: (Player & { teams: (TeamPlayer & { team: Team })[] })[];
};
export const List = ({ players }: ListProps) => {
	const router = useRouter();
	if (players.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No players found")}
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
						label: t("Name"),
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
								</div>
							);
						},
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "ageGroup",
						label: t("Age Group"),
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
						label: t("QTTR"),
						render: (item) => (
							<span className="font-semibold tabular-nums">{item.qttr}</span>
						),
						sortable: true,
						sortFn: (a, b) => a.qttr - b.qttr,
					},
					{
						key: "team",
						label: t("Team"),
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
				]}
				getItemId={(item) => item.id}
				selectMode="none"
				onItemClick={(item) => onClickPlayer(item.id)}
			/>
		</div>
	);
};

import { useRouter } from "@tanstack/react-router";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type ListProps = {
	teams: (Team & { _count: { players: number } })[];
};

export const List = ({ teams }: ListProps) => {
	const router = useRouter();
	if (teams.length === 0) return <div>{t("No teams found")}</div>;

	const onClickTeam = (id: string) => async () => {
		await router.navigate({
			params: { teamId: id },
			to: "/teams/$teamId",
		});
	};

	return (
		<div>
			<table className="table text-xs">
				<thead className="text-xs">
					<tr>
						<th>{t("Title")}</th>
						<th>{t("League")}</th>
						<th>{t("Placement")}</th>
						<th>{t("Players")}</th>
					</tr>
				</thead>
				<tbody>
					{teams.map((team) => (
						<tr
							key={team.id}
							className="hover:bg-base-200 hover:cursor-pointer"
							onClick={onClickTeam(team.id)}
						>
							<td>{team.title}</td>
							<td>{team.league}</td>
							<td>{team.placement}</td>
							<td>{team._count.players}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

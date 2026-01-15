import { useRouter } from "@tanstack/react-router";
import type { Player, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

type ListProps = {
	players: (Player & { team: Team | null })[];
};
export const List = ({ players }: ListProps) => {
	const router = useRouter();
	if (players.length === 0) return <div>{t("No players found")}</div>;

	const onClickPlayer = (id: string) => async () => {
		await router.navigate({
			params: { playerId: id },
			to: "/players/$playerId",
		});
	};

	return (
		<div>
			<table className="table text-xs">
				<thead className="text-xs">
					<tr>
						<th>{t("Name")}</th>
						<th>{t("Age Group")}</th>
						<th>{t("QTTR")}</th>
						<th>{t("Team")}</th>
					</tr>
				</thead>
				<tbody>
					{players.map((player) => (
						<tr
							key={player.id}
							className="hover:bg-base-200 hover:cursor-pointer"
							onClick={onClickPlayer(player.id)}
						>
							<td>{player.name}</td>
							<td>{calculateAgeGroup(player.year)}</td>
							<td>{player.qttr}</td>
							<td>{player.team?.title}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

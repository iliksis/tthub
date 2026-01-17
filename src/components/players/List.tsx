import { useRouter } from "@tanstack/react-router";
import { DetailsList } from "@/components/DetailsList";
import type { Player, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

type ListProps = {
	players: (Player & { team: Team | null })[];
};
export const List = ({ players }: ListProps) => {
	const router = useRouter();
	if (players.length === 0) return <div>{t("No players found")}</div>;

	const onClickPlayer = async (id: string) => {
		await router.navigate({
			params: { playerId: id },
			to: "/players/$playerId",
		});
	};

	return (
		<DetailsList
			items={players}
			columns={[
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
				{
					key: "team",
					label: t("Team"),
					render: (item) => item.team?.title,
					sortable: true,
					sortFn: (a, b) => {
						const teamA = a.team?.title || "";
						const teamB = b.team?.title || "";
						return teamA.localeCompare(teamB);
					},
				},
			]}
			getItemId={(item) => item.id}
			selectMode="none"
			onItemClick={(item) => onClickPlayer(item.id)}
		/>
	);
};

import { useRouter } from "@tanstack/react-router";
import { DetailsList } from "@/components/DetailsList";
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type ListProps = {
	teams: (Team & { _count: { players: number } })[];
};

export const List = ({ teams }: ListProps) => {
	const router = useRouter();
	if (teams.length === 0) return <div>{t("No teams found")}</div>;

	const onClickTeam = async (id: string) => {
		await router.navigate({
			params: { teamId: id },
			to: "/teams/$teamId",
		});
	};

	return (
		<DetailsList
			items={teams}
			columns={[
				{ key: "name", label: t("Name"), render: (item) => item.title },
				{ key: "league", label: t("League"), render: (item) => item.league },
				{
					key: "placement",
					label: t("Placement"),
					render: (item) => item.placement,
				},
				{
					key: "players",
					label: t("Players"),
					render: (item) => item._count.players,
				},
			]}
			getItemId={(item) => item.id}
			selectMode="none"
			onItemClick={(item) => onClickTeam(item.id)}
		/>
	);
};

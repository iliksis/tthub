import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeam } from "@/api/teams";
import type { Player, Team } from "@/lib/prisma/client";

export type TeamDetail = Team & { players: Player[] };

export function useTeamDetail(id: string | undefined) {
	const getTeamServerFn = useServerFn(getTeam);

	const {
		data: team,
		isLoading,
		isError,
	} = useQuery({
		enabled: !!id,
		queryFn: async () => {
			const res = await getTeamServerFn({ data: { id: id as string } });
			return res.data as TeamDetail;
		},
		queryKey: ["team", id],
	});

	return { isError, isLoading, team };
}

import { useServerFn } from "@tanstack/react-start";
import React from "react";
import { getTeam } from "@/api/teams";
import type { Player, Team } from "@/lib/prisma/client";

export type TeamDetail = Team & { players: Player[] };

export function useTeamDetail(id: string | undefined) {
	const getTeamServerFn = useServerFn(getTeam);
	const [team, setTeam] = React.useState<TeamDetail | undefined>(undefined);
	const [isLoading, setIsLoading] = React.useState(false);

	React.useEffect(() => {
		if (!id) {
			setTeam(undefined);
			return;
		}
		let cancelled = false;
		setIsLoading(true);
		getTeamServerFn({ data: { id } }).then(async (res) => {
			const body = await res.json();
			if (cancelled) return;
			if (res.status < 400) setTeam(body.data ?? undefined);
			setIsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [id, getTeamServerFn]);

	return { isLoading, team };
}

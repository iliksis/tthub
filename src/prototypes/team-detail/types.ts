export type PrototypePlayer = {
	id: string;
	name: string;
	year: number;
	qttr: number;
};

export type PrototypeTeam = {
	id: string;
	title: string;
	league: string | null;
	placement: string | null;
	players: PrototypePlayer[];
};

export const teamStats = (team: PrototypeTeam) => {
	const players = team.players;
	const avgQttr = players.length
		? Math.round(players.reduce((sum, p) => sum + p.qttr, 0) / players.length)
		: 0;
	const youngestYear = players.length
		? Math.max(...players.map((p) => p.year))
		: undefined;
	const oldestYear = players.length
		? Math.min(...players.map((p) => p.year))
		: undefined;
	return {
		avgQttr,
		oldestYear,
		playerCount: players.length,
		youngestYear,
	};
};

export type TeamVariantProps = {
	team: PrototypeTeam;
	canEdit: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onPlayerClick: (playerId: string) => void;
};

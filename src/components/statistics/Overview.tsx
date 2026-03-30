import { ActivityIcon, BarChart3Icon, TrendingUpIcon } from "lucide-react";
import React from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type {
	AgeGroupKey,
	PlacementBucketKey,
	StatisticsData,
} from "@/lib/statistics";
import { AGE_GROUP_KEYS, getAgeGroupLabel } from "@/lib/statistics";
import { t } from "@/lib/text";
import { Card as ValueCard } from "../ValueCard";

const chartColors = {
	ageGroups: {
		adult: "var(--color-secondary)",
		u11: "var(--color-accent)",
		u13: "var(--color-info)",
		u15: "var(--color-success)",
		u19: "var(--color-warning)",
	},
	participants: "var(--color-info)",
	participations: "var(--color-primary)",
	placements: {
		first: "var(--color-warning)",
		other: "var(--color-neutral)",
		second: "var(--color-info)",
		third: "var(--catppuccin-color-peach-400)",
		top8: "var(--color-success)",
		unplaced: "var(--color-base-content)",
	},
	tournaments: "var(--catppuccin-color-blue-400)",
} satisfies {
	ageGroups: Record<AgeGroupKey, string>;
	participations: string;
	participants: string;
	placements: Record<PlacementBucketKey, string>;
	tournaments: string;
};

const deltaLabel = (value: number, previousSeason: string | null) => {
	const sign = value > 0 ? "+" : "";
	if (!previousSeason) return t("No previous season data");
	return `${sign}${value} ${t("Compared to {0}", previousSeason)}`;
};

const SectionCard = ({
	children,
	title,
}: React.PropsWithChildren<{ title: string }>) => {
	return (
		<div className="card bg-base-200 shadow-sm">
			<div className="card-body p-4">
				<h2 className="card-title text-base">{title}</h2>
				<div className="h-72">{children}</div>
			</div>
		</div>
	);
};

const EmptyState = ({ message }: { message: string }) => {
	return (
		<div className="flex h-full items-center justify-center text-sm text-base-content/70">
			{message}
		</div>
	);
};

export const Overview = ({ statistics }: { statistics: StatisticsData }) => {
	const [selectedSeriesId, setSelectedSeriesId] = React.useState(
		statistics.linkedTournamentSeries[0]?.id ?? "",
	);
	const selectedSeries =
		statistics.linkedTournamentSeries.find(
			(series) => series.id === selectedSeriesId,
		) ?? statistics.linkedTournamentSeries[0];

	return (
		<div className="flex flex-col gap-4">
			<div>
				<div className="text-sm text-base-content/70">
					{t("Current season")}: {statistics.currentSeason}
				</div>
			</div>

			<div className="grid gap-4 grid-cols-2">
				<ValueCard gridRows={1} title={t("Active players")}>
					<div className="flex items-center gap-3">
						<UsersStatIcon />
						<div>
							<div className="text-3xl font-semibold">
								{statistics.summary.players}
							</div>
							<div className="text-sm text-base-content/70">
								{deltaLabel(
									statistics.summary.playerDelta,
									statistics.summary.previousSeason,
								)}
							</div>
						</div>
					</div>
				</ValueCard>
				<ValueCard gridRows={1} title={t("Tournaments")}>
					<div className="flex items-center gap-3">
						<TrendingUpIcon className="size-8 text-info" />
						<div>
							<div className="text-3xl font-semibold">
								{statistics.summary.tournaments}
							</div>
							<div className="text-sm text-base-content/70">
								{deltaLabel(
									statistics.summary.tournamentDelta,
									statistics.summary.previousSeason,
								)}
							</div>
						</div>
					</div>
				</ValueCard>
			</div>

			<SectionCard title={t("Players by age group")}>
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={statistics.ageGroupCountsBySeason} margin={{}}>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="var(--color-base-300)"
						/>
						<XAxis dataKey="season" stroke="var(--color-base-content)" />
						<YAxis allowDecimals={false} stroke="var(--color-base-content)" />
						<Tooltip
							contentStyle={{
								background: "var(--color-base-100)",
								border: "1px solid var(--color-base-300)",
							}}
						/>
						<Legend />
						{AGE_GROUP_KEYS.map((ageGroup) => (
							<Bar
								key={ageGroup}
								dataKey={ageGroup}
								fill={chartColors.ageGroups[ageGroup]}
								name={getAgeGroupLabel(ageGroup)}
								radius={[4, 4, 0, 0]}
							/>
						))}
					</BarChart>
				</ResponsiveContainer>
			</SectionCard>

			<SectionCard title={t("Linked tournament trend")}>
				{selectedSeries ? (
					<div className="flex h-full flex-col gap-4">
						<select
							className="select"
							value={selectedSeries.id}
							onChange={(e) => setSelectedSeriesId(e.target.value)}
						>
							{statistics.linkedTournamentSeries.map((series) => (
								<option key={series.id} value={series.id}>
									<BarChart3Icon className="size-4" />
									{series.name}
								</option>
							))}
						</select>
						<div className="flex-1">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={selectedSeries.points} margin={{}}>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="var(--color-base-300)"
									/>
									<XAxis dataKey="label" stroke="var(--color-base-content)" />
									<YAxis
										allowDecimals={false}
										stroke="var(--color-base-content)"
									/>
									<Tooltip
										contentStyle={{
											background: "var(--color-base-100)",
											border: "1px solid var(--color-base-300)",
										}}
									/>
									<Legend />
									<Area
										dataKey="participants"
										fill={chartColors.participants}
										fillOpacity={0.25}
										name={t("Participants")}
										stroke={chartColors.participants}
										strokeWidth={3}
										type="monotone"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</div>
				) : (
					<EmptyState message={t("No linked tournament series found")} />
				)}
			</SectionCard>
		</div>
	);
};

const UsersStatIcon = () => {
	return <ActivityIcon className="size-8 text-secondary" />;
};

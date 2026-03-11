import * as React from "react";
import { importMyttPlayers } from "@/api/players";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { notify } from "../Toast";

type PlayerData = {
	name: string;
	rating: string;
};

export const MyTTImport = () => {
	const [players, setPlayers] = React.useState<PlayerData[]>([]);

	const importMutation = useMutation({
		fn: importMyttPlayers,
		onSuccess: async (ctx) => {
			const payload = await ctx.data.json();
			if (ctx.data?.status < 400) {
				setPlayers(payload.data ?? []);
				notify({ status: "success", title: payload.message });
				return;
			}
			notify({ status: "error", title: payload.message });
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<h1>{t("MyTischtennis Import")}</h1>
			<div className="mt-2 flex items-center gap-2">
				<button
					type="button"
					className="btn btn-primary"
					onClick={() => importMutation.mutate(undefined)}
					disabled={importMutation.status === "pending"}
				>
					{importMutation.status === "pending" ? "..." : t("Import")}
				</button>
				{importMutation.status === "success" && (
					<span className="text-sm opacity-70">
						{t("{0} players updated", players.length.toString())}
					</span>
				)}
			</div>
			<div className="alert alert-warning alert-soft flex flex-col gap-2">
				<span>
					{t(
						"The import is scraping the data from the clubs MyTischtennis ranking page and updates the QTTR of existing players found.",
					)}
				</span>

				<span>
					{t(
						"Players not part of the clubs ranking page (e.g. youth players playing in a different club) won't be updated.",
					)}
				</span>
			</div>
			{importMutation.status === "error" && (
				<div role="alert" className="alert alert-error alert-soft mt-2">
					{t("An Error occurred")}
				</div>
			)}
			{importMutation.status === "success" && (
				<div className="overflow-x-auto">
					<table className="table table-sm">
						<thead>
							<tr>
								<th>{t("Name")}</th>
								<th>{t("QTTR")}</th>
							</tr>
						</thead>
						<tbody>
							{players.length === 0 ? (
								<tr>
									<td colSpan={2} className="opacity-70">
										{t("No players found")}
									</td>
								</tr>
							) : (
								players.map((player) => (
									<tr key={`${player.name}-${player.rating}`}>
										<td>{player.name}</td>
										<td>{player.rating}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

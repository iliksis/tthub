import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { deletePlayer, getPlayer, updatePlayer } from "@/api/players";
import { getTeams } from "@/api/teams";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { calculateAgeGroup, isEditorOrAdmin } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/players/$playerId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const [playerRes, teamsRes] = await Promise.all([
			getPlayer({ data: { id: params.playerId } }),
			getTeams(),
		]);
		return { player: playerRes.data, teams: teamsRes.data };
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.player?.name }],
	}),
});

type Placement = NonNullable<
	ReturnType<typeof Route.useLoaderData>["player"]
>["placements"][number];

const placementTone = (placement: string | null) => {
	const rank = placement ? Number.parseInt(placement, 10) : Number.NaN;
	if (rank === 1) return "success" as const;
	if (rank === 2 || rank === 3) return "info" as const;
	return "outline" as const;
};

const groupByYear = (placements: Placement[]) => {
	const groups = new Map<number, Placement[]>();
	for (const placement of placements) {
		const year = new Date(placement.appointment.startDate).getFullYear();
		if (!groups.has(year)) groups.set(year, []);
		// biome-ignore lint/style/noNonNullAssertion: just set above
		groups.get(year)!.push(placement);
	}
	return [...groups.entries()].sort((a, b) => b[0] - a[0]);
};

const formatShortDate = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
	});

function RouteComponent() {
	const router = useRouter();
	const { player, teams } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });

	const canEdit = isEditorOrAdmin(user?.role);

	const [isEditing, setIsEditing] = React.useState(false);

	const [isDeleting, setIsDeleting] = React.useState(false);
	const deletePlayerServerFn = useServerFn(deletePlayer);

	const updatePlayerMutation = useMutation({
		fn: updatePlayer,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	if (!player) return <div>{t("An Error occurred")}</div>;

	const yearGroups = groupByYear(player.placements);

	const onEdit = () => {
		setIsEditing(true);
	};
	const onStopEditing = () => {
		setIsEditing(false);
	};

	const onOpenDelete = () => {
		setIsDeleting(true);
	};
	const onStopDeleting = () => {
		setIsDeleting(false);
	};

	const onDelete = async () => {
		try {
			const res = await deletePlayerServerFn({
				data: { id: player.id },
			});
			await router.invalidate();
			toast.success(res.message);
			await router.navigate({
				to: "..",
			});
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] lg:gap-8">
			{/* Rail */}
			<div className="py-4 lg:border-border/60 lg:border-r lg:py-8 lg:pr-8">
				<h1 className="mt-0.5 font-bold text-2xl tracking-tight">
					{player.name}
				</h1>
				<div className="mt-1 text-muted-foreground text-sm">
					{calculateAgeGroup(player.year)} · {player.year}
				</div>

				{canEdit && (
					<div className="mt-5 flex gap-2">
						<Button
							variant="outline"
							size="sm"
							className="flex-1"
							title={t("Update player")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							title={t("Delete player")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}

				<dl className="mt-6 flex flex-col divide-y divide-border/50 border-border/50 border-y text-sm">
					<div className="flex items-center justify-between py-2.5">
						<dt className="text-muted-foreground">{t("QTTR")}</dt>
						<dd className="font-semibold text-success tabular-nums">
							{player.qttr}
						</dd>
					</div>
					<div className="flex items-center justify-between py-2.5">
						<dt className="text-muted-foreground">{t("Team")}</dt>
						<dd className="font-medium">
							{player.team ? (
								<Link to="/teams/$teamId" params={{ teamId: player.team.id }}>
									{player.team.title}
								</Link>
							) : (
								t("No team set")
							)}
						</dd>
					</div>
					{player.team?.league && (
						<div className="flex items-center justify-between py-2.5">
							<dt className="text-muted-foreground">{t("League")}</dt>
							<dd className="font-medium">{player.team.league}</dd>
						</div>
					)}
				</dl>
			</div>

			{/* Full-width ledger */}
			<div className="py-4 lg:py-8">
				<h2 className="mb-1 font-semibold text-sm">{t("Placements")}</h2>
				{yearGroups.length === 0 && (
					<div className="py-8 text-center text-muted-foreground">
						{t("No items found")}
					</div>
				)}
				{yearGroups.map(([year, items]) => (
					<div key={year} className="mt-3 border-border/60 border-t pt-2 pb-1">
						<div className="mb-1 text-muted-foreground test-sm">{year}</div>
						<div className="flex flex-col">
							{items.map((item) => (
								<Link
									key={`${item.appointmentId}-${item.category}`}
									to="/appts/$apptId"
									params={{ apptId: item.appointmentId }}
									className="block border-border/40 border-b py-2.5 text-foreground no-underline last:border-b-0 hover:bg-muted/50 hover:no-underline"
								>
									{/* Mobile: two stacked lines */}
									<div className="flex flex-col gap-1 lg:hidden">
										<div className="flex items-center justify-between gap-3">
											<span className="truncate font-medium text-sm">
												{item.appointment.title}
											</span>
											<Badge variant={placementTone(item.placement)}>
												{item.placement ?? "–"}
											</Badge>
										</div>
										<div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
											<span className="tabular-nums">
												{formatShortDate(item.appointment.startDate)}
											</span>
											<span className="truncate">{item.category}</span>
										</div>
									</div>

									{/* Desktop: single row */}
									<div className="hidden items-center gap-4 lg:grid lg:grid-cols-[100px_1fr_180px_100px]">
										<span className="text-muted-foreground text-xs tabular-nums">
											{formatShortDate(item.appointment.startDate)}
										</span>
										<span className="truncate font-medium text-sm">
											{item.appointment.title}
										</span>
										<span className="text-muted-foreground text-sm">
											{item.category}
										</span>
										<Badge
											variant={placementTone(item.placement)}
											className="justify-self-end"
										>
											{item.placement ?? "–"}
										</Badge>
									</div>
								</Link>
							))}
						</div>
					</div>
				))}
			</div>

			{canEdit && (
				<>
					<PlayerForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updatePlayerMutation.mutate({
								data: {
									...values,
									id: player.id,
									team: values.team ?? undefined,
								},
							});
						}}
						submitLabel={t("Update")}
						defaultValues={{ ...player, team: player.team?.id ?? null }}
						teams={teams ?? []}
					/>
					<DeleteModal
						label={t("Are you sure you want to delete this player?")}
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

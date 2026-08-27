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
import { AppointmentRow } from "@/components/AppointmentRow";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { useMutation } from "@/hooks/useMutation";
import { calculateAgeGroup, isEditorOrAdmin } from "@/lib/utils";
import { m } from "@/paraglide/messages";

// biome-ignore assist/source/useSortedKeys: head needs to be after loader to access loaderData
export const Route = createFileRoute("/_authed/players/$playerId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const res = await getPlayer({ data: { id: params.playerId } });
		return { player: res.data };
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

function RouteComponent() {
	const router = useRouter();
	const { player } = Route.useLoaderData();
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

	if (!player) return <div>{m.common_an_error_occurred()}</div>;

	const yearGroups = groupByYear(player.placements);
	const currentMembership = player.teams.find((tp) => tp.team.season.isActive);
	const pastMemberships = player.teams.filter(
		(tp) => tp.id !== currentMembership?.id,
	);

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
			<div className="py-4 lg:py-8 lg:pr-8">
				<h1 className="mt-0.5 font-bold text-2xl tracking-tight">
					{player.name}
				</h1>

				{canEdit && (
					<div className="mt-5 flex gap-2">
						<Button
							variant="outline"
							size="sm"
							className="flex-1"
							title={m.players_update_player()}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
							title={m.players_delete_player()}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</Button>
					</div>
				)}

				<div className="mt-6">
					<Section title={m.common_details()}>
						<dl className="flex flex-col text-sm">
							<div className="flex items-center justify-between py-2.5 border-b border-border/60">
								<dt className="text-muted-foreground">
									{m.players_year_of_birth()}
								</dt>
								<dd className="font-medium">
									{player.year} ({calculateAgeGroup(player.year)})
								</dd>
							</div>
							<div className="flex items-center justify-between py-2.5 border-b border-border/60">
								<dt className="text-muted-foreground">{m.common_qttr()}</dt>
								<dd className="font-semibold text-success tabular-nums">
									{player.qttr}
								</dd>
							</div>
							<div className="flex items-center justify-between py-2.5 border-b border-border/60">
								<dt className="text-muted-foreground">{m.common_team()}</dt>
								<dd className="font-medium">
									{currentMembership ? (
										<Link
											to="/teams/$teamId"
											params={{ teamId: currentMembership.team.id }}
										>
											{currentMembership.team.title}
										</Link>
									) : (
										m.players_no_team_set()
									)}
								</dd>
							</div>
							{currentMembership?.team.league && (
								<div className="flex items-center justify-between py-2.5 border-b border-border/60">
									<dt className="text-muted-foreground">{m.common_league()}</dt>
									<dd className="font-medium">
										{currentMembership.team.league}
									</dd>
								</div>
							)}
						</dl>
					</Section>

					{pastMemberships.length > 0 && (
						<div className="mt-6">
							<Section title={m.common_history()}>
								<dl className="flex flex-col text-sm">
									{pastMemberships.map((tp) => (
										<div
											key={tp.id}
											className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-b-0"
										>
											<dt className="text-muted-foreground">
												{tp.team.season.name}
											</dt>
											<dd className="font-medium">
												<Link
													to="/teams/$teamId"
													params={{ teamId: tp.team.id }}
												>
													{tp.team.title}
												</Link>
											</dd>
										</div>
									))}
								</dl>
							</Section>
						</div>
					)}
				</div>
			</div>

			{/* Full-width ledger */}
			<div className="py-4 lg:py-8">
				<Section title={m.players_placements()}>
					{yearGroups.length === 0 && (
						<div className="py-8 text-center text-muted-foreground">
							{m.common_no_items_found()}
						</div>
					)}
					{yearGroups.map(([year, items]) => (
						<div key={year} className="mt-3 border-border border-b pt-2 pb-1">
							<div className="mb-1 text-muted-foreground text-sm">{year}</div>
							<div className="flex flex-col">
								{items.map((item) => (
									<AppointmentRow
										key={`${item.appointmentId}-${item.category}`}
										appointmentId={item.appointmentId}
										title={item.appointment.title}
										date={item.appointment.startDate}
										secondary={item.category}
										badge={{
											label: item.placement ?? "–",
											variant: placementTone(item.placement),
										}}
									/>
								))}
							</div>
						</div>
					))}
				</Section>
			</div>

			{canEdit && (
				<>
					<PlayerForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updatePlayerMutation.mutate({
								data: { ...values, id: player.id },
							});
						}}
						submitLabel={m.common_update()}
						defaultValues={{
							name: player.name,
							qttr: player.qttr,
							year: player.year,
						}}
					/>
					<DeleteModal
						label={m.players_are_you_sure_you_want_to_delete_this_player()}
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

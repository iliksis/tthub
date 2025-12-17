import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { UserCog2Icon, UserRoundPenIcon, UserRoundXIcon } from "lucide-react";
import React from "react";
import { deletePlayer, getPlayer, updatePlayer } from "@/api/players";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { PlayerForm } from "@/components/players/PlayerForm";
import { notify } from "@/components/Toast";
import { Card } from "@/components/ValueCard";
import { useMutation } from "@/hooks/useMutation";

export const Route = createFileRoute("/_authed/players/$playerId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getPlayer({ data: { id: params.playerId } });
		const res = await data.json();
		if (data.status < 400) {
			return { player: res.data };
		}
		throw new Error(res.message);
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.player?.name }],
	}),
});

function RouteComponent() {
	const router = useRouter();
	const { player } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });

	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isEditing, setIsEditing] = React.useState(false);

	const [isDeleting, setIsDeleting] = React.useState(false);
	const deletePlayerServerFn = useServerFn(deletePlayer);

	const updatePlayerMutation = useMutation({
		fn: updatePlayer,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					text: data.message,
					status: "success",
				});
				return;
			}
			notify({ text: data.message, status: "error" });
		},
	});

	if (!player) return <div>An Error occurred</div>;

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
		const res = await deletePlayerServerFn({
			data: { id: player.id },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			notify({ text: data.message, status: "success" });
			await router.navigate({
				to: "..",
			});
			return;
		}
		notify({ text: data.message, status: "error" });
	};

	return (
		<div>
			<div className="grid grid-cols-4 gap-2">
				<Card title="Year of birth" gridRows={3}>
					<p>{player.year}</p>
				</Card>
				<Card title="QTTR" gridRows={1}>
					<p>{player.qttr}</p>
				</Card>
				<Card title="Team" gridRows={4}>
					<p>{player.team?.title || "No team set"}</p>
				</Card>
			</div>
			{canEdit && (
				<>
					<div className="fab">
						{/** biome-ignore lint/a11y/useSemanticElements: fixes safari bug */}
						<div className="btn btn-lg btn-circle" role="button" tabIndex={0}>
							<UserCog2Icon className="size-4" />
						</div>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title="Delete player"
							onClick={onEdit}
						>
							<UserRoundPenIcon className="size-4" />
						</button>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title="Delete player"
							onClick={onOpenDelete}
						>
							<UserRoundXIcon className="size-4" />
						</button>
					</div>

					<PlayerForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updatePlayerMutation.mutate({
								data: { ...values, id: player.id },
							});
						}}
						submitLabel="Update"
						defaultValues={player}
					/>
					<DeleteModal
						label="Are you sure you want to delete this player?"
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

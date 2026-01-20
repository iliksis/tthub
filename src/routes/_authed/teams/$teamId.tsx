import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CogIcon, EditIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { deleteTeam, getTeam, updateTeam } from "@/api/teams";
import { InternalLink } from "@/components/InternalLink";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { notify } from "@/components/Toast";
import { TeamForm } from "@/components/teams/TeamForm";
import { Card } from "@/components/ValueCard";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";

// biome-ignore assist/source/useSortedKeys: head uses loaderData
export const Route = createFileRoute("/_authed/teams/$teamId")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const data = await getTeam({ data: { id: params.teamId } });
		const res = await data.json();
		if (data.status < 400) {
			return { team: res.data };
		}
		throw new Error(res.message);
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.team?.title }],
	}),
});

function RouteComponent() {
	const { team } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [isEditing, setIsEditing] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const deleteTeamServerFn = useServerFn(deleteTeam);

	const updateTeamMutation = useMutation({
		fn: updateTeam,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					status: "success",
					title: data.message,
				});
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	if (!team) return <div>{t("An Error occurred")}</div>;

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
		const res = await deleteTeamServerFn({
			data: { id: team.id },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			notify({ status: "success", title: data.message });
			await router.navigate({
				to: "..",
			});
			return;
		}
		notify({ status: "error", title: data.message });
	};

	return (
		<div className="grid grid-cols-4 gap-2">
			<Card title={t("League")} gridRows={3}>
				{team.league}
			</Card>
			<Card title={t("Placement")} gridRows={1}>
				{team.placement}
			</Card>
			<Card title={t("Players")} gridRows={4}>
				<ul>
					{team.players.map((player) => (
						<li key={player.id} className="py-0.5">
							<InternalLink
								to="/players/$playerId"
								params={{ playerId: player.id }}
							>
								{player.name}
							</InternalLink>
						</li>
					))}
				</ul>
			</Card>
			{canEdit && (
				<>
					<div className="fab">
						{/** biome-ignore lint/a11y/useSemanticElements: fixes safari bug */}
						<div className="btn btn-lg btn-circle" role="button" tabIndex={0}>
							<CogIcon className="size-4" />
						</div>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title={t("Update team")}
							onClick={onEdit}
						>
							<EditIcon className="size-4" />
						</button>
						<button
							className="btn btn-lg btn-circle"
							type="button"
							title={t("Delete team")}
							onClick={onOpenDelete}
						>
							<Trash2Icon className="size-4" />
						</button>
					</div>
					<TeamForm
						open={isEditing}
						onClose={onStopEditing}
						onSubmit={async (values) => {
							await updateTeamMutation.mutate({
								data: { id: team.id, ...values },
							});
						}}
						submitLabel={t("Update")}
						defaultValues={{ league: team.league ?? "", title: team.title }}
					/>
					<DeleteModal
						label={t("Are you sure you want to delete this team?")}
						open={isDeleting}
						onClose={onStopDeleting}
						onDelete={onDelete}
					/>
				</>
			)}
		</div>
	);
}

import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	CopyIcon,
	PencilIcon,
	PlusIcon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	createSeason,
	deleteSeason,
	setActiveSeason,
	updateSeason,
} from "@/api/seasons";
import { DetailsList } from "@/components/DetailsList";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@/hooks/useMutation";
import type { Season } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";
import { CloneTeamsModal } from "./CloneTeamsModal";
import { SeasonForm } from "./SeasonForm";

type SeasonWithStats = Season & {
	_count: { teams: number; appointments: number };
};

type SeasonManagementProps = {
	seasons: SeasonWithStats[];
};

export const SeasonManagement = ({ seasons }: SeasonManagementProps) => {
	const router = useRouter();

	const [showCreateModal, setShowCreateModal] = React.useState(false);
	const [editingSeason, setEditingSeason] = React.useState<Season | null>(null);
	const [cloningIntoSeason, setCloningIntoSeason] =
		React.useState<Season | null>(null);
	const [deletingSeason, setDeletingSeason] = React.useState<Season | null>(
		null,
	);

	const createMutation = useMutation({
		fn: createSeason,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			setShowCreateModal(false);
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const updateMutation = useMutation({
		fn: updateSeason,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			setEditingSeason(null);
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const setActiveMutation = useMutation({
		fn: setActiveSeason,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const deleteSeasonServerFn = useServerFn(deleteSeason);
	const onDelete = async () => {
		if (!deletingSeason) return;
		try {
			const response = await deleteSeasonServerFn({
				data: { id: deletingSeason.id },
			});
			setDeletingSeason(null);
			await router.invalidate();
			toast.success(response.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	return (
		<div className="overflow-x-auto">
			<DetailsList
				items={seasons}
				getItemId={(item) => item.id}
				selectMode="single"
				columns={[
					{
						key: "name",
						label: m.common_name(),
						render: (item) => item.name,
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "isActive",
						label: m.seasons_active(),
						render: (item) =>
							item.isActive ? (
								<Badge variant="default">{m.seasons_active()}</Badge>
							) : null,
					},
					{
						key: "createdAt",
						label: m.common_created(),
						render: (item) => item.createdAt.toLocaleDateString("de-DE"),
					},
					{
						key: "teamCount",
						label: m.common_teams(),
						render: (item) => item._count.teams,
					},
					{
						key: "appointmentCount",
						label: m.common_appointments(),
						render: (item) => item._count.appointments,
					},
				]}
				commandBarItems={[
					{
						icon: <PlusIcon className="size-4" />,
						key: "create-season",
						label: m.common_create(),
						onClick: () => setShowCreateModal(true),
						onlyIcon: true,
						variant: "primary",
					},
					{
						icon: <StarIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1 || items[0].isActive,
						key: "set-active",
						label: m.seasons_set_active(),
						onClick: (items) =>
							setActiveMutation.mutate({ data: { id: items[0].id } }),
						variant: "secondary",
					},
					{
						icon: <PencilIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "rename",
						label: m.seasons_rename_season(),
						onClick: (items) => setEditingSeason(items[0]),
						variant: "secondary",
					},
					{
						icon: <CopyIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "clone-teams",
						label: m.seasons_clone_teams_from(),
						onClick: (items) => setCloningIntoSeason(items[0]),
						variant: "secondary",
					},
					{
						icon: <Trash2Icon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "delete",
						label: m.common_delete(),
						onClick: (items) => setDeletingSeason(items[0]),
						onlyIcon: true,
						variant: "error",
					},
				]}
			/>

			<SeasonForm
				open={showCreateModal}
				defaultValues={{ name: "" }}
				onOpenChange={setShowCreateModal}
				onSubmit={(values) => createMutation.mutate({ data: values })}
				submitLabel={m.common_create()}
			/>

			{editingSeason && (
				<SeasonForm
					open={!!editingSeason}
					defaultValues={{ name: editingSeason.name }}
					onOpenChange={(open) => !open && setEditingSeason(null)}
					onSubmit={(values) =>
						updateMutation.mutate({
							data: { id: editingSeason.id, name: values.name },
						})
					}
					submitLabel={m.common_save()}
				/>
			)}

			{cloningIntoSeason && (
				<CloneTeamsModal
					open={!!cloningIntoSeason}
					onOpenChange={(open) => !open && setCloningIntoSeason(null)}
					targetSeason={cloningIntoSeason}
					sourceOptions={seasons.filter((s) => s.id !== cloningIntoSeason.id)}
				/>
			)}

			{deletingSeason && (
				<DeleteModal
					label={m.seasons_are_you_sure_you_want_to_delete_this_season()}
					open={!!deletingSeason}
					onClose={() => setDeletingSeason(null)}
					onDelete={onDelete}
				/>
			)}
		</div>
	);
};

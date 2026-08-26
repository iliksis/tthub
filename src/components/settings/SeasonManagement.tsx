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
import { t } from "@/lib/text";
import { CloneTeamsModal } from "./CloneTeamsModal";
import { SeasonForm } from "./SeasonForm";

type SeasonManagementProps = {
	seasons: Season[];
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
						label: t("Name"),
						render: (item) => item.name,
						sortable: true,
						sortFn: (a, b) => a.name.localeCompare(b.name),
					},
					{
						key: "isActive",
						label: t("Active"),
						render: (item) =>
							item.isActive ? (
								<Badge variant="default">{t("Active")}</Badge>
							) : null,
					},
				]}
				commandBarItems={[
					{
						icon: <PlusIcon className="size-4" />,
						key: "create-season",
						label: t("Create"),
						onClick: () => setShowCreateModal(true),
						onlyIcon: true,
						variant: "primary",
					},
					{
						icon: <StarIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1 || items[0].isActive,
						key: "set-active",
						label: t("Set active"),
						onClick: (items) =>
							setActiveMutation.mutate({ data: { id: items[0].id } }),
						variant: "secondary",
					},
					{
						icon: <PencilIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "rename",
						label: t("Rename season"),
						onClick: (items) => setEditingSeason(items[0]),
						variant: "secondary",
					},
					{
						icon: <CopyIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "clone-teams",
						label: t("Clone teams from..."),
						onClick: (items) => setCloningIntoSeason(items[0]),
						variant: "secondary",
					},
					{
						icon: <Trash2Icon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "delete",
						label: t("Delete"),
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
				submitLabel={t("Create")}
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
					submitLabel={t("Save")}
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
					label={t("Are you sure you want to delete this season?")}
					open={!!deletingSeason}
					onClose={() => setDeletingSeason(null)}
					onDelete={onDelete}
				/>
			)}
		</div>
	);
};

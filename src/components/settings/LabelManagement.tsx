import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	createLabel,
	deleteLabel,
	type LabelColor,
	reorderLabels,
	updateLabel,
} from "@/api/labels";
import { DetailsList } from "@/components/DetailsList";
import { DeleteModal } from "@/components/modal/DeleteModal";
import { useMutation } from "@/hooks/useMutation";
import type { Label as LabelRecord } from "@/lib/prisma/client";
import { getCatppuccinColorStyle } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LabelForm } from "./LabelForm";

type LabelManagementProps = {
	labels: LabelRecord[];
};

export const LabelManagement = ({ labels }: LabelManagementProps) => {
	const router = useRouter();

	// Reflects the drag-and-drop order immediately (before the server
	// round-trip resolves), so a drop doesn't visually snap back to the old
	// order while `router.invalidate()` is still in flight.
	const [localLabels, setLocalLabels] = React.useState(labels);
	React.useEffect(() => setLocalLabels(labels), [labels]);

	const [showCreateModal, setShowCreateModal] = React.useState(false);
	const [editingLabel, setEditingLabel] = React.useState<LabelRecord | null>(
		null,
	);
	const [deletingLabel, setDeletingLabel] = React.useState<LabelRecord | null>(
		null,
	);

	const createMutation = useMutation({
		fn: createLabel,
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
		fn: updateLabel,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			setEditingLabel(null);
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const reorderLabelsServerFn = useServerFn(reorderLabels);
	const onReorder = async (newLabels: LabelRecord[]) => {
		setLocalLabels(newLabels);
		try {
			await reorderLabelsServerFn({
				data: { ids: newLabels.map((l) => l.id) },
			});
			// Keeps `labels` (the loader data other mutations also refresh
			// through) in sync with the server's reconciled order, rather than
			// leaving `localLabels` as the only place reflecting it.
			await router.invalidate();
		} catch (err) {
			toast.error((err as Error).message);
			// Re-fetches the authoritative order instead of reverting to the
			// `labels` closure captured when this drag started, which could
			// already be stale if another reorder succeeded in the meantime.
			await router.invalidate();
		}
	};

	const deleteLabelServerFn = useServerFn(deleteLabel);
	const onDelete = async () => {
		if (!deletingLabel) return;
		try {
			const response = await deleteLabelServerFn({
				data: { id: deletingLabel.id },
			});
			setDeletingLabel(null);
			await router.invalidate();
			toast.success(response.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	return (
		<div className="overflow-x-auto">
			<DetailsList
				items={localLabels}
				getItemId={(item) => item.id}
				selectMode="single"
				onReorder={onReorder}
				columns={[
					{
						key: "name",
						label: m.labels_name(),
						render: (item) => {
							const style = getCatppuccinColorStyle(item.color as LabelColor);
							return (
								<span className="inline-flex items-center gap-2">
									<span
										className="size-3 shrink-0 rounded-full"
										style={{ backgroundColor: style.backgroundColor }}
									/>
									{item.name}
								</span>
							);
						},
					},
					{
						key: "createdAt",
						label: m.common_created(),
						render: (item) => item.createdAt.toLocaleDateString("de-DE"),
					},
				]}
				commandBarItems={[
					{
						icon: <PlusIcon className="size-4" />,
						key: "create-label",
						label: m.common_create(),
						onClick: () => setShowCreateModal(true),
						onlyIcon: true,
						variant: "primary",
					},
					{
						icon: <PencilIcon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "rename",
						label: m.labels_rename_label(),
						onClick: (items) => setEditingLabel(items[0]),
						variant: "secondary",
					},
					{
						icon: <Trash2Icon className="size-4" />,
						isDisabled: (items) => items.length !== 1,
						key: "delete",
						label: m.common_delete(),
						onClick: (items) => setDeletingLabel(items[0]),
						onlyIcon: true,
						variant: "error",
					},
				]}
			/>

			<LabelForm
				open={showCreateModal}
				title={m.labels_create_label()}
				defaultValues={{ color: "blue", name: "" }}
				onOpenChange={setShowCreateModal}
				onSubmit={(values) => createMutation.mutate({ data: values })}
				submitLabel={m.common_create()}
			/>

			{editingLabel && (
				<LabelForm
					open={!!editingLabel}
					title={m.labels_rename_label()}
					defaultValues={{
						color: editingLabel.color as LabelColor,
						name: editingLabel.name,
					}}
					onOpenChange={(open) => !open && setEditingLabel(null)}
					onSubmit={(values) =>
						updateMutation.mutate({
							data: {
								color: values.color,
								id: editingLabel.id,
								name: values.name,
							},
						})
					}
					submitLabel={m.common_save()}
				/>
			)}

			{deletingLabel && (
				<DeleteModal
					label={m.labels_are_you_sure_you_want_to_delete_this_label()}
					open={!!deletingLabel}
					onClose={() => setDeletingLabel(null)}
					onDelete={onDelete}
				/>
			)}
		</div>
	);
};

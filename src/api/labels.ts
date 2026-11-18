import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { run } from "./kernel.server";
import { type LabelInput, LabelsApi } from "./labels.server";

export type { LabelColor } from "@/lib/labels";

export const getLabels = createServerFn({ method: "GET" }).handler(() =>
	run(LabelsApi, m.labels_labels_found, (api) => api.list()),
);

export const searchLabels = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(({ data }) =>
		run(LabelsApi, m.labels_labels_found, (api) => api.search(data.query)),
	);

export const createLabel = createServerFn()
	.validator((d: LabelInput) => d)
	.handler(({ data }) =>
		run(LabelsApi, m.labels_label_created, (api) => api.create(data)),
	);

export const updateLabel = createServerFn()
	.validator((d: LabelInput & { id: string }) => d)
	.handler(({ data: { id, ...input } }) =>
		run(LabelsApi, m.labels_label_updated, (api) => api.update(id, input)),
	);

export const reorderLabels = createServerFn()
	.validator((d: { ids: string[] }) => d)
	.handler(({ data }) =>
		run(LabelsApi, m.labels_labels_reordered, (api) => api.reorder(data.ids)),
	);

export const deleteLabel = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(({ data }) =>
		run(LabelsApi, m.labels_label_deleted, (api) => api.delete(data.id)),
	);

import { createServerFn } from "@tanstack/react-start";
import { m } from "@/paraglide/messages";
import { ImportsApi } from "./imports.server";
import { run } from "./kernel.server";

export type { ImportJob } from "./imports.server";

export const runImport = createServerFn()
	.validator((d: { importerId: string; config: Record<string, unknown> }) => d)
	.handler(({ data }) =>
		run(ImportsApi, m.imports_import_started, (api) =>
			api.start(data.importerId, data.config),
		),
	);

// Polled every half second; it has no success text to show.
export const getImportProgress = createServerFn()
	.validator((d: { jobId: string }) => d)
	.handler(({ data }) =>
		run(
			ImportsApi,
			() => "",
			(api) => api.progress(data.jobId),
		),
	);

export const getImporterSettings = createServerFn().handler(() =>
	run(ImportsApi, m.imports_importers_found, (api) => api.settings()),
);

export const setImporterEnabled = createServerFn()
	.validator((d: { importerId: string; enabled: boolean }) => d)
	.handler(({ data }) =>
		run(ImportsApi, m.common_settings_updated, (api) =>
			api.setEnabled(data.importerId, data.enabled),
		),
	);

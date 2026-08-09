// src/importers/registry.server.ts
import type { z } from "zod";
import { holidayImporter } from "./holiday-importer.server";
import type { ImporterConfigField, ImporterDefinition } from "./types";

const importers = [
	holidayImporter,
] as const satisfies readonly ImporterDefinition[];

function extractConfigFields(shape: z.ZodRawShape): ImporterConfigField[] {
	return Object.entries(shape).map(([key, fieldSchema]) => ({
		key,
		label: fieldSchema.description ?? key,
		required: !fieldSchema.isOptional(),
		type: /date$/i.test(key) ? "date" : "text",
	}));
}

export function listImporters() {
	return importers.map(({ id, name, description, version, configSchema }) => ({
		configFields: extractConfigFields(configSchema.shape),
		description,
		id,
		name,
		version,
	}));
}

export function getImporter(id: string) {
	return importers.find((importer) => importer.id === id);
}

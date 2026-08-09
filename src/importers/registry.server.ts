// src/importers/registry.server.ts

import { holidayImporter } from "./holiday-importer.server";
import type { ImporterDefinition } from "./types";

const importers = [
	holidayImporter,
] as const satisfies readonly ImporterDefinition[];

export function listImporters() {
	return importers.map(({ id, name, description, version }) => ({
		description,
		id,
		name,
		version,
	}));
}

export function getImporter(id: string) {
	return importers.find((importer) => importer.id === id);
}

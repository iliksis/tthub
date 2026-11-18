// src/importers/types.ts
import type { z } from "zod";
import type { AppointmentType } from "@/lib/prisma/enums";

export type ImportEntity =
	| {
			type: "event";
			externalId: string;
			appointmentType: AppointmentType;
			title: string;
			startsAt: string;
			endsAt?: string;
			metadata?: Record<string, unknown>;
			teamMatch?: { ownTeamId: string; homeTeam: string; awayTeam: string };
	  }
	| {
			type: "data";
			externalId: string;
			payload: Record<string, unknown>;
	  };

export type EmitResult = { status: "imported" | "updated" | "skipped" };

// Importers may also update data themselves with the shared Prisma client
// (`@/lib/db`) inside a transaction, journalling through `AuditJournal` with
// `actorId`. This knowingly bypasses ADR 0004's "only API classes touch Prisma"
// rule (see its Exceptions note); biome and architecture.test only guard
// src/api handler files, so importers need no extra allowance.
export type ImportContext = {
	// The user who started the import, captured at start: the job outlives the
	// request, so it can't be read from the session later.
	actorId: string;
	config: Record<string, unknown>;
	secrets: Record<string, string>;
	cursor?: string;
	emit: (entity: ImportEntity) => Promise<EmitResult>;
	log: (level: "info" | "warn" | "error", message: string) => void;
};

export type ImportResult = {
	imported: number;
	skipped: number;
	// Rows the importer updated itself; ones updated through `emit` are counted there.
	updated?: number;
	// Replaces the generic counts line as the job final message.
	message?: string;
	nextCursor?: string;
};

export type ImporterConfigField = {
	key: string;
	label: string;
	description?: string;
	required: boolean;
	type: "text" | "date";
};

export type ImporterDefinition<TConfig extends z.ZodType = z.ZodType> = {
	id: string;
	version: string;
	name: string;
	description: string;
	configSchema: TConfig;
	secretFields?: string[];
	run(context: ImportContext): Promise<ImportResult>;
};

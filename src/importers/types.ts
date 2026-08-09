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
	  }
	| {
			type: "data";
			externalId: string;
			payload: Record<string, unknown>;
	  };

export type EmitResult = { status: "imported" | "skipped" };

export type ImportContext = {
	config: Record<string, unknown>;
	secrets: Record<string, string>;
	cursor?: string;
	emit: (entity: ImportEntity) => Promise<EmitResult>;
	log: (level: "info" | "warn" | "error", message: string) => void;
	setTotal: (total: number) => void;
};

export type ImportResult = {
	imported: number;
	skipped: number;
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

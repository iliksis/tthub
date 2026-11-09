import type { FeedConfig as FeedConfigRecord } from "@/lib/prisma/client";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";

export interface FeedConfig {
	includeResponseTypes?: ResponseType[];
	includeDraftStatus?: boolean;
	includeAppointmentTypes?: AppointmentType[];
	excludeLabelIds?: string[];
}

type FeedConfigColumns = Pick<
	FeedConfigRecord,
	| "excludeLabelIds"
	| "includeAppointmentTypes"
	| "includeDraftStatus"
	| "includeResponseTypes"
>;

function parseCommaList<T extends string>(
	value: string | null | undefined,
): T[] | undefined {
	return value ? (value.split(",") as T[]) : undefined;
}

// null (not undefined) so a full save clears a list instead of Prisma
// treating it as "leave unchanged".
function joinCommaList(value: string[] | undefined): string | null {
	return value?.length ? value.join(",") : null;
}

// The FeedConfig DB columns store lists comma-joined; these two convert
// between that and the FeedConfig shape the settings page and feed use.
export function parseFeedConfig(
	row: FeedConfigColumns | null | undefined,
): FeedConfig {
	return {
		excludeLabelIds: parseCommaList(row?.excludeLabelIds),
		includeAppointmentTypes: parseCommaList<AppointmentType>(
			row?.includeAppointmentTypes,
		),
		includeDraftStatus: row?.includeDraftStatus ?? false,
		includeResponseTypes: parseCommaList<ResponseType>(
			row?.includeResponseTypes,
		),
	};
}

export function serializeFeedConfig(config: FeedConfig) {
	return {
		excludeLabelIds: joinCommaList(config.excludeLabelIds),
		includeAppointmentTypes: joinCommaList(config.includeAppointmentTypes),
		includeDraftStatus: config.includeDraftStatus ?? false,
		includeResponseTypes: joinCommaList(config.includeResponseTypes),
	};
}

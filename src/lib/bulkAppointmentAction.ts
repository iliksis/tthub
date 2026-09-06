import { toast } from "sonner";
import type {
	AppointmentSelector,
	BulkAppointmentsFilter,
} from "@/api/appointments";

export type PendingSelector =
	| { mode: "ids"; ids: string[] }
	| { mode: "matching" }
	| null;

function buildBaseSelector(
	pending: NonNullable<PendingSelector>,
	excludeIds: Set<string>,
	search: BulkAppointmentsFilter,
): AppointmentSelector {
	// Pick only the whitelisted fields, not whatever else the caller's search
	// object happens to carry (e.g. the route's `skip`) — `matching` is sent
	// to the server as-is, with no runtime validation stripping extra keys.
	return pending.mode === "matching"
		? {
				excludeIds: Array.from(excludeIds),
				matching: {
					query: search.query,
					seasonId: search.seasonId,
					types: search.types,
				},
			}
		: { ids: pending.ids };
}

// Shared by every bulk appointment action (delete, restore, copy-to-season):
// resolves the pending selection into an AppointmentSelector, calls the
// server, then either reports which ids are still in the caller's list (on
// success) or leaves it untouched (on error) — always via `resync`, since the
// server processes a bulk action in chunks and a failure partway through can
// leave some rows already mutated even though the call threw. Never rejects:
// both outcomes are fully handled here (toast included), so callers don't
// need a try/catch of their own.
export async function runBulkAppointmentAction<TPayload>({
	pending,
	excludeIds,
	search,
	serverFn,
	buildPayload,
	resync,
	onSuccess,
}: {
	pending: PendingSelector;
	excludeIds: Set<string>;
	search: BulkAppointmentsFilter;
	serverFn: (args: { data: TPayload }) => Promise<{ message: string }>;
	buildPayload: (base: AppointmentSelector) => TPayload;
	resync: () => Promise<void>;
	onSuccess: (result: { keep: (id: string) => boolean }) => void;
}): Promise<void> {
	if (!pending) return;
	const base = buildBaseSelector(pending, excludeIds, search);
	try {
		const { message } = await serverFn({ data: buildPayload(base) });
		onSuccess({
			keep:
				pending.mode === "matching"
					? (id) => excludeIds.has(id)
					: (id) => !pending.ids.includes(id),
		});
		toast.success(message);
	} catch (err) {
		toast.error((err as Error).message);
	}
	// Fire-and-forget: not awaited, so callers (see useBulkAppointmentAction)
	// can reset their confirm-modal/selection state as soon as the outcome
	// above is known, instead of leaving the modal open — and its confirm
	// button clickable — for the extra round-trip this navigation takes. A
	// rejected navigation just leaves the list stale until the next one; the
	// action's own outcome has already been toasted above, so it's never
	// allowed to escape as an unhandled rejection.
	resync().catch(() => {});
}

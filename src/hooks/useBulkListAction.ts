import type { useRouter } from "@tanstack/react-router";
import type { RowSelectionState } from "@tanstack/react-table";
import React from "react";
import { toast } from "sonner";
import type { AppointmentSelector } from "@/api/appointments";
import type { AppointmentType } from "@/lib/prisma/enums";

export type PendingSelector =
	| { mode: "ids"; ids: string[] }
	| { mode: "matching" }
	| null;

// Shared by bulk.tsx's onDelete and trash.tsx's onRestore — both pages build
// an AppointmentSelector from the current selection (explicit ids, or the
// active filters plus exclude-list when "select all matching" is on), call
// the same-shaped bulk server fn, then reconcile local state (optimistic
// item removal, selection reset, router refresh, toast) the same way.
export function useBulkListAction<T extends { id: string }>({
	serverFn,
	search,
	excludeIds,
	exitSelectAllMatching,
	setExplicitSelection,
	setItems,
	router,
}: {
	serverFn: (args: {
		data: AppointmentSelector;
	}) => Promise<{ message: string }>;
	search: {
		query?: string;
		seasonId?: string;
		types?: AppointmentType[];
	};
	excludeIds: Set<string>;
	exitSelectAllMatching: () => void;
	setExplicitSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
	setItems: React.Dispatch<React.SetStateAction<T[]>>;
	router: ReturnType<typeof useRouter>;
}) {
	const [isConfirming, setIsConfirming] = React.useState(false);
	const [pending, setPending] = React.useState<PendingSelector>(null);

	const run = async () => {
		if (!pending) return;
		try {
			const response = await serverFn({
				data:
					pending.mode === "matching"
						? {
								excludeIds: Array.from(excludeIds),
								matching: {
									query: search.query,
									seasonId: search.seasonId,
									types: search.types,
								},
							}
						: { ids: pending.ids },
			});
			if (pending.mode === "matching") {
				setItems((prev) => prev.filter((item) => excludeIds.has(item.id)));
				exitSelectAllMatching();
			} else {
				const actedIds = pending.ids;
				setItems((prev) => prev.filter((item) => !actedIds.includes(item.id)));
				setExplicitSelection({});
			}
			setIsConfirming(false);
			setPending(null);
			// Navigate back to the first page (omitting `skip`) rather than a
			// plain router.invalidate(): invalidate() re-runs the loader for the
			// *current* skip, which only refetches whatever page the user was on
			// — if they'd already paged past the first batch via "load more",
			// `items` would keep the optimistic splice above with no way to
			// reconcile it against the server for the rest of the list. Resetting
			// to skip=0 forces useLoadMoreBatch's fresh-view path to fully resync
			// `items` from authoritative data instead.
			await router.navigate({
				replace: true,
				search: {
					query: search.query,
					seasonId: search.seasonId,
					types: search.types,
				},
				to: ".",
			});
			toast.success(response.message);
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	return { isConfirming, pending, run, setIsConfirming, setPending };
}

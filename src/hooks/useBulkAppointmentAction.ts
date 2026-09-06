import type { RowSelectionState } from "@tanstack/react-table";
import React from "react";
import type {
	AppointmentSelector,
	BulkAppointmentsFilter,
} from "@/api/appointments";
import {
	type PendingSelector,
	runBulkAppointmentAction,
} from "@/lib/bulkAppointmentAction";

// Thin React wrapper around runBulkAppointmentAction: owns the
// isConfirming/pending UI state and resets it (plus selection) once the core
// settles, whether it succeeded or failed — the core itself never throws, so
// there's nothing to catch here.
export function useBulkAppointmentAction<T extends { id: string }, TPayload>({
	serverFn,
	buildPayload,
	resync,
	search,
	excludeIds,
	exitSelectAllMatching,
	setExplicitSelection,
	setItems,
}: {
	serverFn: (args: { data: TPayload }) => Promise<{ message: string }>;
	buildPayload: (base: AppointmentSelector) => TPayload;
	resync: () => Promise<void>;
	search: BulkAppointmentsFilter;
	excludeIds: Set<string>;
	exitSelectAllMatching: () => void;
	setExplicitSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
	// Omit for actions that don't remove items from the current list (e.g.
	// copy-to-season); delete/restore pass their setItems to drop acted-on rows.
	setItems?: React.Dispatch<React.SetStateAction<T[]>>;
}) {
	const [isConfirming, setIsConfirming] = React.useState(false);
	const [pending, setPending] = React.useState<PendingSelector>(null);

	const run = async () => {
		await runBulkAppointmentAction({
			buildPayload,
			excludeIds,
			onSuccess: ({ keep }) => {
				setItems?.((prev) => prev.filter((item) => keep(item.id)));
			},
			pending,
			resync,
			search,
			serverFn,
		});
		setIsConfirming(false);
		setPending(null);
		setExplicitSelection({});
		exitSelectAllMatching();
	};

	return { isConfirming, pending, run, setIsConfirming, setPending };
}

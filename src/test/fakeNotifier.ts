import type { Notifier } from "@/api/notifier.server";

// Records what a class asked the notifier to send (ADR 0004: the notifier is
// the one collaborator faked in API class tests).
export function createFakeNotifier() {
	const calls: (
		| { kind: "published" | "updated"; id: string; actorId: string | null }
		| { kind: "cancelUpdated"; id: string }
		| { kind: "test" }
	)[] = [];
	const notifier: Notifier = {
		cancelUpdated: (id) => {
			calls.push({ id, kind: "cancelUpdated" });
		},
		published: ({ id }, actorId) => {
			calls.push({ actorId, id, kind: "published" });
		},
		test: async () => {
			calls.push({ kind: "test" });
		},
		updated: ({ id }, actorId) => {
			calls.push({ actorId, id, kind: "updated" });
		},
	};
	return { calls, notifier };
}

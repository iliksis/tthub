import type { SessionStore } from "@/api/kernel.server";
import type { SessionUser } from "@/lib/session";

// In-memory SessionStore recording what a class signed in (or out).
export function createFakeSession(initial: SessionUser | null = null) {
	const state: { stored: SessionUser | null; cleared: number } = {
		cleared: 0,
		stored: initial,
	};
	const store: SessionStore = {
		clear: async () => {
			state.stored = null;
			state.cleared++;
		},
		update: async (user) => {
			state.stored = { ...user };
		},
	};
	return { state, store };
}

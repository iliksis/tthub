// PROTOTYPE. Injected collaborator (decided). Real one: module-level singleton
// owning the 5s debounce map; tests inject a recording fake.
import type { Appointment } from "@/lib/prisma/client";

export type Notifier = {
	published(appointment: Appointment, actorId: string | null): void;
	updated(appointment: Appointment, actorId: string | null): void; // debounced
	cancelUpdated(appointmentId: string): void;
};

export const notifier: Notifier = {
	cancelUpdated: () => {},
	published: () => {},
	updated: () => {},
};

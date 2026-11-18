// The push-notification side effect of appointment mutations (ADR 0004,
// issue #101). Not an API class: no policy table, no session. Callers pass
// the acting user explicitly so their own devices are skipped.
//
// Sends are fire-and-forget: callers invoke `published`/`updated` after their
// transaction has committed, nothing awaits delivery, and a failed push is
// logged instead of failing the mutation. `test` is the one awaited send.
import webpush from "web-push";
import { prismaClient } from "@/lib/db";
import type { PrismaClient } from "@/lib/prisma/client";
import { formatTanstackRouterPath } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export type NotifiedAppointment = { id: string; title: string };

export type Notifier = {
	// A tournament became visible (created published, or published later).
	published: (appointment: NotifiedAppointment, actorId: string | null) => void;
	// A published tournament changed. Debounced per appointment: a burst of
	// click-to-edit saves collapses into one push, sent as the latest actor.
	updated: (appointment: NotifiedAppointment, actorId: string | null) => void;
	// Drops a pending `updated` push (e.g. the appointment was deleted).
	cancelUpdated: (appointmentId: string) => void;
	// Pushes a test message to every subscription; rejects if one fails.
	test: () => Promise<void>;
};

export type PushMessage = {
	badge: string;
	body: string;
	title: string;
	url: string;
};
type PushTarget = { endpoint: string; auth: string; p256dh: string };
export type Push = (target: PushTarget, message: PushMessage) => Promise<void>;

const pushMessage = (message: Omit<PushMessage, "badge">): PushMessage => ({
	badge: "/favicon-96x96.png",
	...message,
});

// Which settings toggle opts a recipient in, and the push title, per scope.
const SCOPES = {
	new: {
		setting: "newAppointment",
		title: () => m.appointments_new_appointment(),
	},
	updated: {
		setting: "changedAppointment",
		title: () => m.appointments_appointment_updated(),
	},
} as const;
type Scope = keyof typeof SCOPES;

export function createNotifier({
	db,
	push,
	debounceMs,
}: {
	db: PrismaClient;
	push: Push;
	debounceMs: number;
}): Notifier {
	// In-memory, so it assumes a single server process: a restart drops
	// pending update pushes. Deliberately no DB outbox (issue #101).
	const pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();

	const send = async (
		scope: Scope,
		appointment: NotifiedAppointment,
		actorId: string | null,
	) => {
		const { setting, title } = SCOPES[scope];
		// Labels are read at send time so a debounced push reflects the
		// appointment's labels when it goes out, not when the save came in.
		const labelIds = (
			await db.appointmentLabel.findMany({
				select: { labelId: true },
				where: { appointmentId: appointment.id },
			})
		).map((l) => l.labelId);
		const recipients = await db.notificationSettings.findMany({
			include: { subscription: true },
			where: {
				[setting]: true,
				NOT: actorId ? { userId: actorId } : undefined,
				// A recipient whose muted labels intersect the appointment's is
				// skipped (CONTEXT.md "Muted Label"). No labels, no intersection.
				user:
					labelIds.length > 0
						? { mutedLabels: { none: { labelId: { in: labelIds } } } }
						: undefined,
			},
		});
		const message = pushMessage({
			body: appointment.title,
			title: title(),
			url: formatTanstackRouterPath("/appts/$apptId", {
				apptId: appointment.id,
			}),
		});
		const results = await Promise.allSettled(
			recipients.map(({ subscription }) => push(subscription, message)),
		);
		for (const result of results) {
			if (result.status === "rejected") {
				console.error("[Notifier] push failed", result.reason);
			}
		}
	};

	const fireAndForget = (
		scope: Scope,
		appointment: NotifiedAppointment,
		actorId: string | null,
	) => {
		send(scope, appointment, actorId).catch((e) => {
			console.error(`[Notifier] ${scope} ${appointment.id}`, e);
		});
	};

	const cancelUpdated = (appointmentId: string) => {
		const pending = pendingUpdates.get(appointmentId);
		if (pending) {
			clearTimeout(pending);
			pendingUpdates.delete(appointmentId);
		}
	};

	return {
		cancelUpdated,
		published: (appointment, actorId) =>
			fireAndForget("new", appointment, actorId),
		test: async () => {
			const subscriptions = await db.subscription.findMany();
			const message = pushMessage({
				body: m.notifications_test_notification_body(),
				title: m.notifications_test_notification_title(),
				url: "/",
			});
			for (const subscription of subscriptions) {
				await push(subscription, message);
			}
		},
		updated: (appointment, actorId) => {
			cancelUpdated(appointment.id);
			pendingUpdates.set(
				appointment.id,
				setTimeout(() => {
					pendingUpdates.delete(appointment.id);
					fireAndForget("updated", appointment, actorId);
				}, debounceMs),
			);
		},
	};
}

const webPush: Push = async ({ endpoint, auth, p256dh }, message) => {
	const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) {
		throw new Error("VAPID keys are not configured");
	}
	webpush.setVapidDetails("mailto:mail@example.com", publicKey, privateKey);
	await webpush.sendNotification(
		{ endpoint, keys: { auth, p256dh } },
		JSON.stringify(message),
	);
};

// The process-wide notifier: one debounce map shared by every request.
export const notifier = createNotifier({
	db: prismaClient,
	debounceMs: 5000,
	push: webPush,
});

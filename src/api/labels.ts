import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import type { catppuccinColorNames } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export type LabelColor = (typeof catppuccinColorNames)[number];

// Shared by every Appointment query across src/api/appointments.ts and
// src/routes/feed/$feedId.ts that needs an appointment's attached Labels in
// priority order (badge display order, and resolveTopPriorityLabel's color
// resolution for the calendar/iCal) — one place to change if that shape ever
// needs to, instead of the 7 call sites this used to be copy-pasted across.
export const labelsInclude = {
	include: { label: true },
	orderBy: { label: { priority: "asc" } },
} as const;

export const getLabels = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const labels = await prismaClient.label.findMany({
			orderBy: { priority: "asc" },
		});
		return { data: labels, message: m.labels_labels_found() };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

export const searchLabels = createServerFn()
	.validator((d: { query?: string }) => d)
	.handler(async ({ data }) => {
		try {
			const labels = await prismaClient.label.findMany({
				orderBy: { priority: "asc" },
				take: 10,
				where: { name: { contains: data.query ?? "" } },
			});
			return { data: labels, message: m.labels_labels_found() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const createLabel = createServerFn()
	.validator((d: { name: string; color: LabelColor }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// New labels start at the bottom of the priority list (lowest
			// priority) so creating one never silently outranks an established
			// label's color on existing appointments. Reading the current max and
			// creating in one transaction avoids two concurrent creates both
			// reading the same max and colliding on the same priority.
			const label = await prismaClient.$transaction(async (tx) => {
				const highestPriority = await tx.label.aggregate({
					_max: { priority: true },
				});
				return tx.label.create({
					data: {
						color: data.color,
						name: data.name,
						priority: (highestPriority._max.priority ?? -1) + 1,
					},
				});
			});
			return { data: label, message: m.labels_label_created() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const updateLabel = createServerFn()
	.validator((d: { id: string; name: string; color: LabelColor }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			const label = await prismaClient.label.update({
				data: { color: data.color, name: data.name },
				where: { id: data.id },
			});
			return { data: label, message: m.labels_label_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const reorderLabels = createServerFn()
	.validator((d: { ids: string[] }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// `data.ids` is expected to be the full catalog in its new order, but
			// the client's snapshot can go stale (another editor created or
			// deleted a label while this one was dragging) — reconcile against
			// the current catalog inside the transaction rather than trusting it
			// blindly, so a stale payload can't orphan or collide priorities:
			// known ids keep the client's order, anything missing is appended
			// afterward in its previous relative order.
			await prismaClient.$transaction(async (tx) => {
				const currentLabels = await tx.label.findMany({
					orderBy: { priority: "asc" },
					select: { id: true },
				});
				const currentIds = new Set(currentLabels.map((l) => l.id));
				const orderedIds = data.ids.filter((id) => currentIds.has(id));
				const knownIds = new Set(orderedIds);
				const missingIds = currentLabels
					.map((l) => l.id)
					.filter((id) => !knownIds.has(id));
				const finalOrder = [...orderedIds, ...missingIds];

				await Promise.all(
					finalOrder.map((id, index) =>
						tx.label.update({
							data: { priority: index },
							where: { id },
						}),
					),
				);
			});
			return { message: m.labels_labels_reordered() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deleteLabel = createServerFn()
	.validator((d: { id: string }) => d)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
		}

		try {
			// AppointmentLabel rows cascade-delete automatically (onDelete: Cascade).
			await prismaClient.label.delete({
				where: { id: data.id },
			});
			return { message: m.labels_label_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

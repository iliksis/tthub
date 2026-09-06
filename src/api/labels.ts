import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import type { catppuccinColorNames } from "@/lib/utils";
import { m } from "@/paraglide/messages";

export type LabelColor = (typeof catppuccinColorNames)[number];

export const getLabels = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const labels = await prismaClient.label.findMany({
			orderBy: { name: "asc" },
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
				orderBy: { name: "asc" },
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
			const label = await prismaClient.label.create({
				data: { color: data.color, name: data.name },
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

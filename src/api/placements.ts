import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

export const createPlacement = createServerFn()
	.inputValidator(
		(d: {
			category: string;
			playerId: string;
			appointmentId: string;
			placement?: string;
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const existing = await prismaClient.placement.findUnique({
				select: {
					placement: true,
				},
				where: {
					playerId_appointmentId_category: {
						appointmentId: data.appointmentId,
						category: data.category,
						playerId: data.playerId,
					},
				},
			});

			if (existing) {
				throw new Error(t("Participant already exists in this category"));
			}

			const placement = await prismaClient.placement.create({
				data: {
					appointmentId: data.appointmentId,
					category: data.category,
					placement: data.placement,
					playerId: data.playerId,
				},
			});

			return { data: placement, message: t("Placement created") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const getUniqueCategories = createServerFn().handler(async () => {
	try {
		const categories = await prismaClient.placement.groupBy({
			by: ["category"],
		});
		const result = categories.map((c) => c.category);
		return { data: result, message: t("Categories found") };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

export const updatePlacement = createServerFn()
	.inputValidator(
		(d: {
			playerId: string;
			appointmentId: string;
			category: string;
			updates: {
				placement: string;
			};
		}) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const placement = await prismaClient.placement.update({
				data: {
					placement: data.updates.placement,
				},
				where: {
					playerId_appointmentId_category: {
						appointmentId: data.appointmentId,
						category: data.category,
						playerId: data.playerId,
					},
				},
			});

			return { data: placement, message: t("Placement updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deletePlacement = createServerFn()
	.inputValidator(
		(d: { playerId: string; appointmentId: string; category: string }) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const placement = await prismaClient.placement.delete({
				where: {
					playerId_appointmentId_category: {
						appointmentId: data.appointmentId,
						category: data.category,
						playerId: data.playerId,
					},
				},
			});

			return { data: placement, message: t("Placement deleted") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

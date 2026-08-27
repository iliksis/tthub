import { createServerFn } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { m } from "@/paraglide/messages";

export const createPlacement = createServerFn()
	.validator(
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
			throw new Error(m.common_unauthorized());
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
				throw new Error(
					m.placements_participant_already_exists_in_this_category(),
				);
			}

			const placement = await prismaClient.placement.create({
				data: {
					appointmentId: data.appointmentId,
					category: data.category,
					placement: data.placement,
					playerId: data.playerId,
				},
			});

			return { data: placement, message: m.placements_placement_created() };
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
		return { data: result, message: m.placements_categories_found() };
	} catch (e) {
		console.error(e);
		throw new Error((e as Error).message);
	}
});

export const updatePlacement = createServerFn()
	.validator(
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
			throw new Error(m.common_unauthorized());
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

			return { data: placement, message: m.placements_placement_updated() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

export const deletePlacement = createServerFn()
	.validator(
		(d: { playerId: string; appointmentId: string; category: string }) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			throw new Error(m.common_unauthorized());
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

			return { data: placement, message: m.placements_placement_deleted() };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

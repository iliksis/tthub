import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";
import type { Return } from "./types";

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
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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
				return json<Return>(
					{ message: t("Participant already exists in this category") },
					{ status: 400 },
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

			return json<Return<typeof placement>>(
				{ data: placement, message: t("Placement created") },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const getUniqueCategories = createServerFn().handler(async () => {
	try {
		const categories = await prismaClient.placement.groupBy({
			by: ["category"],
		});
		const result = categories.map((c) => c.category);
		return json<Return<typeof result>>(
			{ data: result, message: t("Categories found") },
			{ status: 200 },
		);
	} catch (e) {
		console.log(e);
		const error = e as Error;
		return json<Return>({ message: error.message }, { status: 400 });
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
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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

			return json<Return<typeof placement>>(
				{ data: placement, message: t("Placement updated") },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

export const deletePlacement = createServerFn()
	.inputValidator(
		(d: { playerId: string; appointmentId: string; category: string }) => d,
	)
	.handler(async ({ data }) => {
		const isAuthorized = await useIsRole("EDITOR");
		if (!isAuthorized) {
			return json<Return>({ message: t("Unauthorized") }, { status: 401 });
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

			return json<Return<typeof placement>>(
				{ data: placement, message: t("Placement deleted") },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

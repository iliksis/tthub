import { createServerFn, json } from "@tanstack/react-start";
import { prismaClient } from "@/lib/db";
import { useIsRole } from "@/lib/session";
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const existing = await prismaClient.placement.findUnique({
				where: {
					playerId_appointmentId_category: {
						playerId: data.playerId,
						appointmentId: data.appointmentId,
						category: data.category,
					},
				},
				select: {
					placement: true,
				},
			});

			if (existing) {
				return json<Return>(
					{ message: "Participant already exists in this category" },
					{ status: 400 },
				);
			}

			const placement = await prismaClient.placement.create({
				data: {
					category: data.category,
					playerId: data.playerId,
					appointmentId: data.appointmentId,
					placement: data.placement,
				},
			});

			return json<Return<typeof placement>>(
				{ message: "Placement created", data: placement },
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
			{ message: "Categories found", data: result },
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const placement = await prismaClient.placement.update({
				where: {
					playerId_appointmentId_category: {
						playerId: data.playerId,
						appointmentId: data.appointmentId,
						category: data.category,
					},
				},
				data: {
					placement: data.updates.placement,
				},
			});

			return json<Return<typeof placement>>(
				{ message: "Placement updated", data: placement },
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
			return json<Return>({ message: "Unauthorized" }, { status: 401 });
		}

		try {
			const placement = await prismaClient.placement.delete({
				where: {
					playerId_appointmentId_category: {
						playerId: data.playerId,
						appointmentId: data.appointmentId,
						category: data.category,
					},
				},
			});

			return json<Return<typeof placement>>(
				{ message: "Placement deleted", data: placement },
				{ status: 200 },
			);
		} catch (e) {
			console.log(e);
			const error = e as Error;
			return json<Return>({ message: error.message }, { status: 400 });
		}
	});

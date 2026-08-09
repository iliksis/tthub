import { createServerFn } from "@tanstack/react-start";
import { getImporter } from "@/importers/registry.server";
import type { EmitResult, ImportEntity } from "@/importers/types";
import { prismaClient } from "@/lib/db";
import { TransactionType } from "@/lib/prisma/enums";
import { requireEditor } from "@/lib/session";
import { t } from "@/lib/text";

async function persistEntity(
	entity: ImportEntity,
	userId: string,
): Promise<EmitResult> {
	if (entity.type !== "event") {
		throw new Error(`Import entity type "${entity.type}" is not supported`);
	}

	const existingAppointment = await prismaClient.appointment.findUnique({
		where: { id: entity.externalId },
	});
	if (existingAppointment) {
		return { status: "skipped" };
	}

	await prismaClient.$transaction(async (tx) => {
		const appointment = await tx.appointment.create({
			data: {
				endDate: entity.endsAt ? new Date(entity.endsAt) : null,
				id: entity.externalId,
				shortTitle: entity.title,
				startDate: new Date(entity.startsAt),
				title: entity.title,
				type: entity.appointmentType,
			},
		});
		await tx.transaction.create({
			data: {
				appointmentId: appointment.id,
				type: TransactionType.CREATE,
				userId,
			},
		});
	});

	return { status: "imported" };
}

export const runImport = createServerFn()
	.validator((d: { importerId: string; config: Record<string, unknown> }) => d)
	.handler(async ({ data }) => {
		const session = await requireEditor();
		if (!session) {
			throw new Error(t("Unauthorized"));
		}

		try {
			const importer = getImporter(data.importerId);
			if (!importer) {
				throw new Error(t("Importer not found"));
			}

			const result = await importer.run({
				config: data.config,
				emit: (entity) => persistEntity(entity, session.id),
				log: (level, message) => console[level](`[${importer.id}] ${message}`),
				secrets: {},
			});

			return {
				data: result,
				message:
					result.imported === 1
						? t("1 appointment created")
						: t("{0} Appointments created", result.imported.toString()),
			};
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

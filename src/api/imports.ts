import { createServerFn } from "@tanstack/react-start";
import { getImporter, listImporters } from "@/importers/registry.server";
import type { EmitResult, ImportEntity } from "@/importers/types";
import { prismaClient } from "@/lib/db";
import { TransactionType } from "@/lib/prisma/enums";
import { requireAdmin, requireEditor } from "@/lib/session";
import { t } from "@/lib/text";

async function isImporterEnabled(importerId: string) {
	const setting = await prismaClient.importerSetting.findUnique({
		where: { importerId },
	});
	return setting?.enabled ?? true;
}

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
			if (!importer || !(await isImporterEnabled(importer.id))) {
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

export const getAvailableImporters = createServerFn().handler(async () => {
	const session = await requireEditor();
	if (!session) {
		throw new Error(t("Unauthorized"));
	}

	const enabled = await Promise.all(
		listImporters().map(async (importer) => ({
			enabled: await isImporterEnabled(importer.id),
			importer,
		})),
	);

	return {
		data: enabled
			.filter((entry) => entry.enabled)
			.map(({ importer }) => importer),
		message: t("Importers found"),
	};
});

export const getImporterSettings = createServerFn().handler(async () => {
	const session = await requireAdmin();
	if (!session) {
		throw new Error(t("Unauthorized"));
	}

	const settings = await Promise.all(
		listImporters().map(async (importer) => ({
			...importer,
			enabled: await isImporterEnabled(importer.id),
		})),
	);

	return { data: settings, message: t("Importers found") };
});

export const setImporterEnabled = createServerFn()
	.validator((d: { importerId: string; enabled: boolean }) => d)
	.handler(async ({ data }) => {
		const session = await requireAdmin();
		if (!session) {
			throw new Error(t("Unauthorized"));
		}

		try {
			if (!getImporter(data.importerId)) {
				throw new Error(t("Importer not found"));
			}

			await prismaClient.importerSetting.upsert({
				create: { enabled: data.enabled, importerId: data.importerId },
				update: { enabled: data.enabled },
				where: { importerId: data.importerId },
			});

			return { message: t("Settings updated") };
		} catch (e) {
			console.error(e);
			throw new Error((e as Error).message);
		}
	});

import { z } from "zod";
import { AuditJournal } from "@/api/auditLog.domain.server";
import { ApiError } from "@/api/kernel.server";
import { prismaClient } from "@/lib/db";
import { ttrViewerBaseUrl } from "@/lib/ttrViewer";
import { m } from "@/paraglide/messages";
import type { ImporterDefinition } from "./types";

const CHUNK_SIZE = 1000;
// Node's fetch would otherwise wait about 5 minutes on a silent service.
const FETCH_TIMEOUT_MS = 30_000;

type QttrResponse = {
	players: ({ id: string; qttr: number } | null)[];
};

const fetchChunk = async (base: string, ids: string[]) => {
	let res: Response;
	try {
		res = await fetch(`${base}/api/qttr`, {
			body: JSON.stringify({ ids }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
	} catch {
		throw new ApiError(m.imports_qttr_service_failed());
	}
	if (!res.ok) throw new ApiError(m.imports_qttr_service_failed());
	const body = (await res.json().catch(() => null)) as QttrResponse | null;
	if (!Array.isArray(body?.players)) {
		throw new ApiError(m.imports_qttr_service_failed());
	}
	return body;
};

export const qttrImporter = {
	configSchema: z.object({}),
	description: m.imports_qttr_description(),
	id: "qttr",
	name: m.imports_qttr_name(),

	async run({ actorId, log }) {
		const base = ttrViewerBaseUrl();
		if (!base) throw new ApiError(m.imports_qttr_not_configured());

		const withId = await prismaClient.player.findMany({
			where: { myTischtennisId: { not: null } },
		});
		const total = await prismaClient.player.count();

		// Collect every chunk first so a failure leaves the data untouched.
		// Players the service returns as null or in notFound get no entry.
		const qttrById = new Map<string, number>();
		const ids = withId.map((p) => p.myTischtennisId as string);
		for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
			const body = await fetchChunk(base, ids.slice(i, i + CHUNK_SIZE));
			for (const p of body.players) if (p) qttrById.set(p.id, p.qttr);
		}

		let updated = 0;
		await prismaClient.$transaction(async (tx) => {
			const journal = new AuditJournal(tx, "Player", actorId);
			for (const player of withId) {
				const qttr = qttrById.get(player.myTischtennisId as string);
				if (qttr === undefined || qttr === player.qttr) continue;
				const after = await tx.player.update({
					data: { qttr },
					where: { id: player.id },
				});
				await journal.updated(player.id, player, after, ["qttr"]);
				updated++;
			}
		});

		const skipped = total - updated;
		const missing = withId
			.filter((p) => !qttrById.has(p.myTischtennisId as string))
			.map((p) => p.name);
		log("info", `Updated ${updated} players, skipped ${skipped}`);

		return {
			imported: 0,
			message: missing.length
				? m.imports_qttr_not_found({
						param1: updated.toString(),
						param2: skipped.toString(),
						param3: missing.join(", "),
					})
				: m.imports_qttr_done({
						param1: updated.toString(),
						param2: skipped.toString(),
					}),
			skipped,
			updated,
		};
	},
	version: "1.0.0",
} satisfies ImporterDefinition;

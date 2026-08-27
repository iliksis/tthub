import { prismaClient } from "../src/lib/db";

// Standalone fixture script (run via `npx tsx e2e/seed-trash-data-display.ts`
// with DATABASE_URL pointed at the e2e test.db) for
// appointments-trash.spec.ts's "Data Display" and "Restore" blocks. Re-run
// clears any leftovers from a previous run first, so it's safe to call
// before each test. Seeds a mix of soft-deleted appointment types (HOLIDAY x2,
// a season-scoped TOURNAMENT) so the season/type filters have something to
// narrow.
const SHORT_TITLE_PREFIX = "E2ETRASHDD-";

async function main() {
	const staleIds = await prismaClient.appointment.findMany({
		select: { id: true },
		where: { shortTitle: { startsWith: SHORT_TITLE_PREFIX } },
	});
	const staleWhere = { appointmentId: { in: staleIds.map((a) => a.id) } };
	await prismaClient.transaction.deleteMany({ where: staleWhere });
	await prismaClient.response.deleteMany({ where: staleWhere });
	await prismaClient.placement.deleteMany({ where: staleWhere });
	await prismaClient.appointment.deleteMany({
		where: { shortTitle: { startsWith: SHORT_TITLE_PREFIX } },
	});

	const season = await prismaClient.season.findFirstOrThrow({
		where: { isActive: true },
	});

	const now = new Date();
	now.setHours(17, 0, 0, 0);

	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: null,
			shortTitle: `${SHORT_TITLE_PREFIX}Feiertag1`,
			startDate: now,
			title: "E2ETRASHDD Feiertag 1",
			type: "HOLIDAY",
		},
	});
	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: null,
			shortTitle: `${SHORT_TITLE_PREFIX}Feiertag2`,
			startDate: now,
			title: "E2ETRASHDD Feiertag 2",
			type: "HOLIDAY",
		},
	});
	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: now,
			location: "Sporthalle",
			seasonId: season.id,
			shortTitle: `${SHORT_TITLE_PREFIX}Turnier1`,
			startDate: now,
			status: "PUBLISHED",
			title: "E2ETRASHDD Turnier 1",
			type: "TOURNAMENT",
		},
	});

	console.log("✅ Seeded trash data-display fixture appointments");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding trash data-display fixture:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

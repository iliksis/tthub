import { prismaClient } from "../src/lib/db";

// Standalone fixture script (run via `npx tsx e2e/seed-trash-appointments.ts <count>`
// with DATABASE_URL pointed at the e2e test.db) that seeds a batch of
// soft-deleted appointments distinguishable by a shortTitle prefix, for tests
// in appointments-trash.spec.ts that need more matching rows than fit in one
// loaded page (BATCH_SIZE in src/routes/_authed/appts/trash.tsx). Re-run
// clears any appointments from a previous run first, so it's safe to call
// before each test.
const SHORT_TITLE_PREFIX = "E2ETRASH-";

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

	const count = Number(process.argv[2] ?? 30);
	const now = new Date();

	for (let i = 0; i < count; i++) {
		await prismaClient.appointment.create({
			data: {
				deletedAt: now,
				endDate: null,
				shortTitle: `${SHORT_TITLE_PREFIX}${i}`,
				startDate: new Date(now.getTime() + i * 86_400_000),
				title: `E2E Trash Appointment ${i}`,
				type: "HOLIDAY",
			},
		});
	}

	console.log(`✅ Seeded ${count} trash-test appointments`);
}

main()
	.catch((e) => {
		console.error("❌ Error seeding trash-test appointments:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

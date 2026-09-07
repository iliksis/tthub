import { prismaClient } from "../src/lib/db";
import { cleanupByTitlePrefix } from "./helpers";

// Standalone fixture script (run via `npx tsx e2e/seed-bulk-appointments.ts <count>`
// with DATABASE_URL pointed at the e2e test.db) that seeds a batch of
// appointments distinguishable by a title prefix, for tests in
// appointments-bulk.spec.ts that need more matching rows than fit in one
// loaded page (BATCH_SIZE in src/routes/_authed/appts/bulk.tsx). Re-run
// clears any appointments from a previous run first, so it's safe to call
// before each test.
const SHORT_TITLE_PREFIX = "E2EBULK-";

async function main() {
	await cleanupByTitlePrefix(SHORT_TITLE_PREFIX);

	const count = Number(process.argv[2] ?? 30);
	const now = new Date();

	for (let i = 0; i < count; i++) {
		await prismaClient.appointment.create({
			data: {
				endDate: null,
				startDate: new Date(now.getTime() + i * 86_400_000),
				title: `${SHORT_TITLE_PREFIX}${i}`,
				type: "HOLIDAY",
			},
		});
	}

	console.log(`✅ Seeded ${count} bulk-test appointments`);
}

main()
	.catch((e) => {
		console.error("❌ Error seeding bulk-test appointments:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

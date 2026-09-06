import { prismaClient } from "../src/lib/db";
import { cleanupByTitlePrefix } from "./helpers";

// Standalone fixture script (run via `npx tsx e2e/seed-trash-appointments.ts <count>`
// with DATABASE_URL pointed at the e2e test.db) that seeds a batch of
// soft-deleted appointments distinguishable by a title prefix, for tests
// in appointments-trash.spec.ts that need more matching rows than fit in one
// loaded page (BATCH_SIZE in src/routes/_authed/appts/trash.tsx). Re-run
// clears any appointments from a previous run first, so it's safe to call
// before each test.
const SHORT_TITLE_PREFIX = "E2ETRASH-";

// A single non-matching trashed appointment seeded alongside the TRASH_QUERY
// batch so the page's unfiltered total is never accidentally equal to the
// filtered (matching) count. Without this, an empty trash otherwise seeded
// with exactly N TRASH_QUERY rows makes "N von N Ereignissen" true before
// the search box's debounced filter has actually committed, letting tests
// race ahead of the real navigation — see the "Select All Matching Filters"
// tests in appointments-trash.spec.ts, which assert on that summary text to
// know the filter has landed.
const NOISE_PREFIX = "E2ETRASHNOISE-";

async function main() {
	await cleanupByTitlePrefix(SHORT_TITLE_PREFIX);
	await cleanupByTitlePrefix(NOISE_PREFIX);

	const count = Number(process.argv[2] ?? 30);
	const now = new Date();

	for (let i = 0; i < count; i++) {
		await prismaClient.appointment.create({
			data: {
				deletedAt: now,
				endDate: null,
				startDate: new Date(now.getTime() + i * 86_400_000),
				title: `${SHORT_TITLE_PREFIX}${i}`,
				type: "HOLIDAY",
			},
		});
	}

	if (count > 0) {
		await prismaClient.appointment.create({
			data: {
				deletedAt: now,
				endDate: null,
				startDate: now,
				title: `${NOISE_PREFIX}0`,
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

import { prismaClient } from "../src/lib/db";
import { cleanupByTitlePrefix } from "./helpers";

// Standalone fixture script (run via `npx tsx e2e/seed-trash-data-display.ts`
// with DATABASE_URL pointed at the e2e test.db) for
// appointments-trash.spec.ts's "Data Display" and "Restore" blocks. Re-run
// clears any leftovers from a previous run first, so it's safe to call
// before each test. Seeds a mix of soft-deleted appointment types (HOLIDAY x2,
// a season-scoped TOURNAMENT) so the season/type filters have something to
// narrow.
const SHORT_TITLE_PREFIX = "E2ETRASHDD-";

async function main() {
	await cleanupByTitlePrefix(SHORT_TITLE_PREFIX);

	// `--cleanup-only` (used in an afterAll to leave no fixture data behind
	// once the tests that need this fixture finish) stops here — the cleanup
	// above already removed everything.
	if (process.argv[2] === "--cleanup-only") {
		console.log("✅ Cleaned up trash data-display fixture appointments");
		return;
	}

	const season = await prismaClient.season.findFirstOrThrow({
		where: { isActive: true },
	});

	const now = new Date();
	now.setHours(17, 0, 0, 0);

	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: null,
			startDate: now,
			title: `${SHORT_TITLE_PREFIX}Feiertag1`,
			type: "HOLIDAY",
		},
	});
	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: null,
			startDate: now,
			title: `${SHORT_TITLE_PREFIX}Feiertag2`,
			type: "HOLIDAY",
		},
	});
	await prismaClient.appointment.create({
		data: {
			deletedAt: now,
			endDate: now,
			location: "Sporthalle",
			seasonId: season.id,
			startDate: now,
			status: "PUBLISHED",
			title: `${SHORT_TITLE_PREFIX}Turnier1`,
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

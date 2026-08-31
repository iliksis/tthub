import { prismaClient } from "../src/lib/db";
import { cleanupByShortTitlePrefix } from "./helpers";

// Standalone fixture script (run via `npx tsx e2e/seed-copy-to-season.ts` with
// DATABASE_URL pointed at the e2e test.db) for appointments-bulk.spec.ts's
// "Copy to season" tests. Re-run clears any leftovers from a previous run
// first, so it's safe to call before each test. Seeds a dedicated target
// Season plus a mix of season-scoped TOURNAMENT appointments (eligible for
// copying) and a HOLIDAY appointment (no seasonId, expected to be skipped).
const SHORT_TITLE_PREFIX = "E2ECOPY-";
const TARGET_SEASON_NAME = "E2ECOPY-Target";

async function main() {
	await cleanupByShortTitlePrefix(SHORT_TITLE_PREFIX);
	await prismaClient.season.deleteMany({
		where: { name: TARGET_SEASON_NAME },
	});

	// `--cleanup-only` (used in an afterAll to leave no fixture data behind
	// once the "Copy to season" tests finish) stops here — the cleanup above
	// already removed everything.
	if (process.argv[2] === "--cleanup-only") {
		console.log("✅ Cleaned up copy-to-season fixture appointments");
		return;
	}

	const sourceSeason = await prismaClient.season.findFirstOrThrow({
		where: { isActive: true },
	});
	await prismaClient.season.create({
		data: { isActive: false, name: TARGET_SEASON_NAME },
	});

	const now = new Date();
	now.setHours(17, 0, 0, 0);

	await prismaClient.appointment.create({
		data: {
			endDate: now,
			location: "Sporthalle",
			seasonId: sourceSeason.id,
			shortTitle: `${SHORT_TITLE_PREFIX}Turnier1`,
			startDate: now,
			status: "PUBLISHED",
			title: "E2ECOPY Turnier 1",
			type: "TOURNAMENT",
		},
	});
	await prismaClient.appointment.create({
		data: {
			endDate: now,
			location: "Sporthalle",
			seasonId: sourceSeason.id,
			shortTitle: `${SHORT_TITLE_PREFIX}Turnier2`,
			startDate: now,
			status: "DRAFT",
			title: "E2ECOPY Turnier 2",
			type: "TOURNAMENT",
		},
	});
	await prismaClient.appointment.create({
		data: {
			endDate: null,
			shortTitle: `${SHORT_TITLE_PREFIX}Feiertag`,
			startDate: now,
			title: "E2ECOPY Feiertag",
			type: "HOLIDAY",
		},
	});

	console.log("✅ Seeded copy-to-season fixture appointments");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding copy-to-season fixture:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

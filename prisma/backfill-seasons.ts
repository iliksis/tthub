// One-time data migration: run manually (`npx tsx prisma/backfill-seasons.ts`)
// against a real, already-populated database after the "add_seasons" migration
// has been applied and before the follow-up migration makes seasonId required.
// Not part of `prisma migrate deploy` — fresh/CI/e2e databases have no existing
// rows to backfill and simply get an empty Season table until seeded.
import { prismaClient } from "../src/lib/db";

async function main() {
	const existingSeason = await prismaClient.season.findFirst();
	if (existingSeason) {
		throw new Error(
			"A Season already exists — refusing to run the backfill again to avoid duplicating data.",
		);
	}

	const season = await prismaClient.season.create({
		data: { name: "Bestand", isActive: true },
	});

	const { count: teamCount } = await prismaClient.team.updateMany({
		data: { seasonId: season.id },
	});

	const { count: appointmentCount } = await prismaClient.appointment.updateMany({
		data: { seasonId: season.id },
	});

	const playersWithTeam = await prismaClient.player.findMany({
		where: { teamId: { not: null } },
		select: { id: true, teamId: true },
	});
	const { count: rosterCount } = await prismaClient.teamPlayer.createMany({
		data: playersWithTeam.map((player) => ({
			// biome-ignore lint/style/noNonNullAssertion: filtered by teamId not-null above
			teamId: player.teamId!,
			playerId: player.id,
			seasonId: season.id,
		})),
	});

	console.log(`✅ Created legacy season "${season.name}" (${season.id})`);
	console.log(`   ${teamCount} teams assigned to it`);
	console.log(`   ${appointmentCount} appointments assigned to it`);
	console.log(`   ${rosterCount} roster memberships created from existing player.teamId`);
}

main()
	.catch((e) => {
		console.error("❌ Error backfilling seasons:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

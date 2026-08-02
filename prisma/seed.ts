import { prismaClient } from "../src/lib/db";
import { hashPassword } from "../src/lib/db";

async function main() {
	console.log("🌱 Seeding database...");

	// Clear db
	await prismaClient.userInvitation.deleteMany();
	await prismaClient.passwordReset.deleteMany();
	await prismaClient.notificationSettings.deleteMany();
	await prismaClient.subscription.deleteMany();
	await prismaClient.placement.deleteMany();
	await prismaClient.team.deleteMany();
	await prismaClient.player.deleteMany();
	await prismaClient.response.deleteMany();
	await prismaClient.appointment.deleteMany();
	await prismaClient.user.deleteMany();

	// Create example users with different roles
	const password = "password123";
	const hashedPassword = await hashPassword(password);
	
	const adminUser = await prismaClient.user.create({
		data: {
			userName: "admin",
			name: "Admin User",
			password: hashedPassword,
			role: "ADMIN",
		},
	});

	const editorUser = await prismaClient.user.create({
		data: {
			userName: "editor",
			name: "Editor User",
			password: hashedPassword,
			role: "EDITOR",
		},
	});

	const regularUser = await prismaClient.user.create({
		data: {
			userName: "user",
			name: "Regular User",
			password: hashedPassword,
			role: "USER",
		},
	});

	// Create sample teams
	const team1 = await prismaClient.team.create({
		data: {
			title: "U13 Team A",
			league: "Regionalliga",
			placement: "3. Platz",
		},
	});

	const team2 = await prismaClient.team.create({
		data: {
			title: "U15 Team B",
			league: "Landesliga",
		},
	});

	// Create sample players
	await prismaClient.player.create({
		data: {
			name: "Max Mustermann",
			year: 2010,
			qttr: 1500,
			teamId: team1.id,
		},
	});

	await prismaClient.player.create({
		data: {
			name: "Lisa Schmidt",
			year: 2011,
			qttr: 1450,
			teamId: team1.id,
		},
	});

	// Create sample appointments
	// Dated relative to "now" (rather than a fixed past date) so they stay
	// selectable/upcoming regardless of when the e2e suite runs, and so the
	// multi-select/bulk-action tests always have at least 3 rows to work with.
	const daysFromNow = (days: number) => {
		const date = new Date();
		date.setDate(date.getDate() + days);
		date.setHours(17, 0, 0, 0);
		return date;
	};

	await prismaClient.appointment.create({
		data: {
			title: "Training Session",
			shortTitle: "Training",
			type: "TOURNAMENT",
			status: "PUBLISHED",
			startDate: daysFromNow(7),
			endDate: daysFromNow(7),
			location: "Sporthalle",
		},
	});

	await prismaClient.appointment.create({
		data: {
			title: "Bezirksliga Spieltag 1",
			shortTitle: "Bezirksliga",
			type: "TOURNAMENT",
			status: "DRAFT",
			startDate: daysFromNow(14),
			endDate: daysFromNow(14),
			location: "Sporthalle Nord",
		},
	});

	await prismaClient.appointment.create({
		data: {
			title: "Kreispokal Finale",
			shortTitle: "Kreispokal",
			type: "TOURNAMENT",
			status: "PUBLISHED",
			startDate: daysFromNow(21),
			endDate: daysFromNow(21),
			location: "Sporthalle Süd",
		},
	});

	console.log("✅ Created users:");
	console.log("   Admin:", { userName: adminUser.userName, password, role: "ADMIN" });
	console.log("   Editor:", { userName: editorUser.userName, password, role: "EDITOR" });
	console.log("   User:", { userName: regularUser.userName, password, role: "USER" });
	console.log("✅ Created 2 teams, 2 players, 3 appointments");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

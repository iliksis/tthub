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
	await prismaClient.appointment.create({
		data: {
			title: "Training Session",
			shortTitle: "Training",
			type: "TOURNAMENT",
			status: "PUBLISHED",
			startDate: new Date("2026-02-01T17:00:00"),
			endDate: new Date("2026-02-01T19:00:00"),
			location: "Sporthalle",
		},
	});

	console.log("✅ Created users:");
	console.log("   Admin:", { userName: adminUser.userName, password, role: "ADMIN" });
	console.log("   Editor:", { userName: editorUser.userName, password, role: "EDITOR" });
	console.log("   User:", { userName: regularUser.userName, password, role: "USER" });
	console.log("✅ Created 2 teams, 2 players, 1 appointment");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

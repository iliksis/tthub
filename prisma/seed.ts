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

	// Create example users
	const password = "password";
	const hashedPassword = await hashPassword("password");
	const user = await prismaClient.user.create({
		data: {
			userName: "user",
			name: "User",
			password: hashedPassword,
			role: "ADMIN",
		},
	});

	console.log("✅ Created user:", {
		userName: user.userName,
		password: password,
	});
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prismaClient.$disconnect();
	});

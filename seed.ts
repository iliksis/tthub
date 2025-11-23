import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./src/lib/prisma";

const prisma = new PrismaClient();

async function main() {
	console.log("🌱 Seeding database...");

	// Clear existing todos
	await prisma.todo.deleteMany();

	// Create example todos
	const todos = await prisma.todo.createMany({
		data: [
			{ title: "Buy groceries" },
			{ title: "Read a book" },
			{ title: "Workout" },
		],
	});

	console.log(`✅ Created ${todos.count} todos`);

	// Clear existing users
	await prisma.user.deleteMany();

	// Create example users
	const password = "password";
	const hashedPassword = await hashPassword("password");
	const user = await prisma.user.create({
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
		await prisma.$disconnect();
	});

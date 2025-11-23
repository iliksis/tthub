import "dotenv/config";
import crypto from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./prisma/client";

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL ?? "",
});
export const prismaClient = new PrismaClient({ adapter });

export function hashPassword(password: string) {
	return new Promise<string>((resolve, reject) => {
		crypto.pbkdf2(password, "salt", 100000, 32, "sha256", (err, derivedKey) => {
			if (err) {
				reject(err);
			} else {
				resolve(derivedKey.toString("hex"));
			}
		});
	});
}

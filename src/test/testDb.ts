import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { PrismaClient } from "@/lib/prisma/client";

const migrationsDir = path.resolve(__dirname, "../../prisma/migrations");

export const migrationNames = () =>
	fs
		.readdirSync(migrationsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();

// Applies the real migrations (optionally only those up to and including
// `upTo`) to a fresh throwaway SQLite file.
export function createTestDb(upTo?: string) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tthub-test-"));
	const file = path.join(dir, "test.db");
	const raw = new Database(file);
	const apply = (names: string[]) => {
		for (const name of names) {
			raw.exec(
				fs.readFileSync(
					path.join(migrationsDir, name, "migration.sql"),
					"utf8",
				),
			);
		}
	};
	const names = migrationNames();
	apply(upTo ? names.slice(0, names.indexOf(upTo) + 1) : names);
	// Migrations insert a legacy Season; start every test from no Seasons.
	raw.exec("DELETE FROM TeamPlayer; DELETE FROM Team; DELETE FROM Season;");
	return {
		applyRemaining: () => {
			if (!upTo) throw new Error("applyRemaining needs createTestDb(upTo)");
			apply(names.slice(names.indexOf(upTo) + 1));
		},
		close: () => {
			raw.close();
			fs.rmSync(dir, { force: true, recursive: true });
		},
		prisma: new PrismaClient({
			adapter: new PrismaBetterSqlite3({ url: `file:${file}` }),
		}),
		raw,
	};
}

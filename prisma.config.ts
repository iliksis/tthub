import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "./schema.prisma",
	migrations: {
		path: "./migrations",
		seed: "tsx seed.ts",
	},
	datasource: {
		url: env("DATABASE_URL"),
	}
})
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardrails for the API classes migration (ADR 0004). The list of migrated
// handler files is shared with Biome: it is the `includes` of the override in
// biome.json that turns on `noRestrictedImports`. Add a file there when its
// aggregate migrates; this test then holds it to the thin-handler rules.

const root = path.resolve(__dirname, "../..");
const apiDir = path.join(root, "src/api");
const read = (file: string) => fs.readFileSync(file, "utf8");

type BiomeOverride = {
	includes?: string[];
	linter?: { rules?: { style?: { noRestrictedImports?: unknown } } };
};
const migratedHandlerFiles = (): string[] => {
	const biome = JSON.parse(read(path.join(root, "biome.json"))) as {
		overrides?: BiomeOverride[];
	};
	const override = biome.overrides?.find(
		(o) => o.linter?.rules?.style?.noRestrictedImports,
	);
	if (!override?.includes) {
		throw new Error("biome.json has no noRestrictedImports override");
	}
	return override.includes;
};

const apiClassFiles = fs
	.readdirSync(apiDir)
	.filter(
		(f) =>
			f.endsWith(".server.ts") &&
			f !== "kernel.server.ts" &&
			!f.endsWith(".domain.server.ts"),
	);

// Value imports (and value re-exports) a handler file may use. Type-only
// imports/exports are free: they are erased and carry no logic.
const allowedValueSources = (file: string) => [
	"@tanstack/react-start",
	"@/paraglide/messages",
	"./kernel.server",
	`./${path.basename(file, ".ts")}.server`,
];

const valueModuleSources = (source: string) => [
	...[
		...source.matchAll(
			/^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gms,
		),
	]
		// `import { type A, type B } from` is type-only too.
		.filter(([, clause]) => !/^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(clause))
		.map(([, , from]) => from),
	// Side-effect imports: `import "x";`
	...[...source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map(
		([, from]) => from,
	),
];

describe("API classes", () => {
	it("finds at least one API class", () => {
		expect(apiClassFiles.length).toBeGreaterThan(0);
	});

	it.each(apiClassFiles)(
		"%s exports an ApiBase class with an exhaustive policy table",
		(file) => {
			const source = read(path.join(apiDir, file));
			const match = source.match(/export class (\w+Api) extends ApiBase\b/);
			expect(match, "export class XApi extends ApiBase").not.toBeNull();
			const name = match?.[1];
			expect(source).toMatch(
				new RegExp(
					`static readonly policy = \\{[^}]*\\} as const satisfies Policies<${name}>`,
				),
			);
		},
	);
});

describe("migrated handler files", () => {
	const files = migratedHandlerFiles();

	it("lists only existing src/api handler files", () => {
		for (const file of files) {
			expect(file).toMatch(/^src\/api\/[\w-]+\.ts$/);
			expect(fs.existsSync(path.join(root, file)), file).toBe(true);
		}
	});

	it.each(files)("%s has its API class next to it", (file) => {
		const server = path.join(root, file.replace(/\.ts$/, ".server.ts"));
		expect(fs.existsSync(server)).toBe(true);
	});

	it.each(files)("%s only imports the framework and its API class", (file) => {
		const sources = valueModuleSources(read(path.join(root, file)));
		const allowed = allowedValueSources(file);
		expect(sources.filter((s) => !allowed.includes(s))).toEqual([]);
	});

	it.each(files)("%s handlers are one-liners delegating to run()", (file) => {
		const source = read(path.join(root, file));
		expect(source).not.toMatch(/\btry\s*\{|\bcatch\s*[({]/);
		expect(source).not.toMatch(/prismaClient|\$transaction|useAppSession/);
		const handlers = source.match(/\.handler\(/g)?.length ?? 0;
		// Each handler is an expression-bodied arrow straight into run(...).
		const delegating =
			source.match(/\.handler\(\s*(?:\([^)]*\)|\w+)\s*=>\s*run\(/g)?.length ??
			0;
		expect(handlers).toBeGreaterThan(0);
		expect(delegating).toBe(handlers);
	});
});

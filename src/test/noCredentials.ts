import { expect } from "vitest";

// Classes never return a User row with its credential field (issue #106):
// walk any returned value and fail if a `password` key appears anywhere.
export function expectNoCredentials(value: unknown) {
	const paths: string[] = [];
	const walk = (v: unknown, path: string) => {
		if (Array.isArray(v)) {
			v.forEach((item, i) => {
				walk(item, `${path}[${i}]`);
			});
		} else if (v && typeof v === "object" && !(v instanceof Date)) {
			for (const [key, child] of Object.entries(v)) {
				if (key === "password") paths.push(`${path}.${key}`);
				walk(child, `${path}.${key}`);
			}
		}
	};
	walk(value, "$");
	expect(paths, "credential fields in returned data").toEqual([]);
}

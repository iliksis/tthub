import { describe, expect, it } from "vitest";
import { catppuccinLatteHex, resolveTopPriorityLabel } from "./labelColor";
import { catppuccinColorNames } from "./utils";

describe("resolveTopPriorityLabel", () => {
	it("returns undefined for an empty list", () => {
		expect(resolveTopPriorityLabel([])).toBeUndefined();
	});

	it("returns the only label when there's one", () => {
		const label = { color: "blue", priority: 3 };
		expect(resolveTopPriorityLabel([label])).toBe(label);
	});

	it("returns the label with the lowest priority value among several", () => {
		const low = { color: "peach", priority: 5 };
		const highest = { color: "mauve", priority: 0 };
		const mid = { color: "teal", priority: 2 };
		expect(resolveTopPriorityLabel([low, highest, mid])).toBe(highest);
	});

	it("picks the winner regardless of input array order", () => {
		const highest = { color: "mauve", priority: 0 };
		const low = { color: "peach", priority: 5 };
		expect(resolveTopPriorityLabel([highest, low])).toBe(highest);
	});
});

describe("catppuccinLatteHex", () => {
	it("has a valid hex value for every Catppuccin color name", () => {
		for (const name of catppuccinColorNames) {
			expect(catppuccinLatteHex[name]).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it("has exactly the 14 Catppuccin color names, no more, no fewer", () => {
		expect(Object.keys(catppuccinLatteHex).sort()).toEqual(
			[...catppuccinColorNames].sort(),
		);
	});
});

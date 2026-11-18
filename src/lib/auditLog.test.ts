import { describe, expect, it } from "vitest";
import { diffFields } from "./auditLog";

describe("diffFields", () => {
	it("records only the listed fields whose value changed", () => {
		const before = { location: "Halle", status: "DRAFT", title: "KM" };
		const after = { location: "Halle", status: "PUBLISHED", title: "KM 2026" };
		expect(diffFields(before, after, ["location", "title"])).toEqual({
			title: { new: "KM 2026", old: "KM" },
		});
	});

	it("compares dates by value, not identity", () => {
		const before = { startDate: new Date("2026-03-01") };
		expect(
			diffFields(before, { startDate: new Date("2026-03-01") }, ["startDate"]),
		).toEqual({});
		expect(
			diffFields(before, { startDate: new Date("2026-03-02") }, ["startDate"]),
		).toEqual({
			startDate: { new: new Date("2026-03-02"), old: new Date("2026-03-01") },
		});
	});

	it("treats null and a value as different", () => {
		expect(diffFields({ link: null }, { link: "https://x" }, ["link"])).toEqual(
			{ link: { new: "https://x", old: null } },
		);
	});

	it("returns an empty object when nothing changed", () => {
		expect(diffFields({ a: 1 }, { a: 1 }, ["a"])).toEqual({});
	});
});

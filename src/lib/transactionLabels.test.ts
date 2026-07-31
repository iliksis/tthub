import { describe, expect, it } from "vitest";
import { TransactionType } from "@/lib/prisma/enums";
import {
	fieldLabels,
	formatChangeValue,
	getChangedFields,
	transactionActionBadge,
} from "./transactionLabels";

describe("getChangedFields", () => {
	it("returns an empty array for null changes", () => {
		expect(getChangedFields(null)).toEqual([]);
	});

	it("returns an empty array for empty changes", () => {
		expect(getChangedFields({})).toEqual([]);
	});

	it("maps known fields to their labels", () => {
		const changes = {
			location: { new: "Berlin", old: "Munich" },
			title: { new: "New Title", old: "Old Title" },
		};
		expect(getChangedFields(changes)).toEqual([
			fieldLabels.location,
			fieldLabels.title,
		]);
	});

	it("falls back to the raw field name for unknown fields", () => {
		const changes = { customField: { new: "b", old: "a" } };
		expect(getChangedFields(changes)).toEqual(["customField"]);
	});
});

describe("formatChangeValue", () => {
	it("returns an em dash for null, undefined, or empty values", () => {
		expect(formatChangeValue("title", null)).toBe("—");
		expect(formatChangeValue("title", undefined)).toBe("—");
		expect(formatChangeValue("title", "")).toBe("—");
	});

	it("maps known status values to their labels", () => {
		expect(formatChangeValue("status", "DRAFT")).toBe("Entwurf");
		expect(formatChangeValue("status", "PUBLISHED")).toBe("Veröffentlicht");
	});

	it("falls back to the raw value for unknown status values", () => {
		expect(formatChangeValue("status", "ARCHIVED")).toBe("ARCHIVED");
	});

	it("formats ISO date strings as de-DE dates", () => {
		expect(formatChangeValue("startDate", "2026-03-05T10:00:00.000Z")).toBe(
			"05.03.2026",
		);
	});

	it("leaves non-date strings untouched", () => {
		expect(formatChangeValue("location", "Berlin")).toBe("Berlin");
	});

	it("stringifies non-string values", () => {
		expect(formatChangeValue("someField", 42)).toBe("42");
		expect(formatChangeValue("someField", true)).toBe("true");
	});
});

describe("transactionActionBadge", () => {
	it("returns a success badge for CREATE", () => {
		expect(transactionActionBadge(TransactionType.CREATE)).toEqual({
			label: "Erstellt",
			variant: "success",
		});
	});

	it("returns a destructive badge for DELETE", () => {
		expect(transactionActionBadge(TransactionType.DELETE)).toEqual({
			label: "Gelöscht",
			variant: "destructive",
		});
	});

	it("returns an info badge for UPDATE", () => {
		expect(transactionActionBadge(TransactionType.UPDATE)).toEqual({
			label: "Geändert",
			variant: "info",
		});
	});
});

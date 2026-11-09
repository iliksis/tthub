import { describe, expect, it } from "vitest";
import { AuditAction } from "@/lib/prisma/enums";
import {
	auditActionBadge,
	fieldLabel,
	formatChangeValue,
	getChangedFields,
} from "./auditLabels";

describe("fieldLabel", () => {
	it("looks up a field label by entity type", () => {
		expect(fieldLabel("Appointment", "title")).toBe("Titel");
	});

	it("falls back to the raw field name for unknown fields or entity types", () => {
		expect(fieldLabel("Appointment", "customField")).toBe("customField");
		expect(fieldLabel("Unknown", "title")).toBe("title");
	});
});

describe("getChangedFields", () => {
	it("returns an empty array for null changes", () => {
		expect(getChangedFields("Appointment", null)).toEqual([]);
	});

	it("returns an empty array for empty changes", () => {
		expect(getChangedFields("Appointment", {})).toEqual([]);
	});

	it("maps known fields to their labels", () => {
		const changes = {
			location: { new: "Berlin", old: "Munich" },
			title: { new: "New Title", old: "Old Title" },
		};
		expect(getChangedFields("Appointment", changes)).toEqual([
			fieldLabel("Appointment", "location"),
			fieldLabel("Appointment", "title"),
		]);
	});

	it("falls back to the raw field name for unknown fields", () => {
		const changes = { customField: { new: "b", old: "a" } };
		expect(getChangedFields("Appointment", changes)).toEqual(["customField"]);
	});
});

describe("formatChangeValue", () => {
	it("returns an em dash for null, undefined, or empty values", () => {
		expect(formatChangeValue("Appointment", "title", null)).toBe("—");
		expect(formatChangeValue("Appointment", "title", undefined)).toBe("—");
		expect(formatChangeValue("Appointment", "title", "")).toBe("—");
	});

	it("maps known appointment status values to their labels", () => {
		expect(formatChangeValue("Appointment", "status", "DRAFT")).toBe("Entwurf");
		expect(formatChangeValue("Appointment", "status", "PUBLISHED")).toBe(
			"Veröffentlicht",
		);
	});

	it("falls back to the raw value for unknown values or entity types", () => {
		expect(formatChangeValue("Appointment", "status", "ARCHIVED")).toBe(
			"ARCHIVED",
		);
		expect(formatChangeValue("Unknown", "status", "DRAFT")).toBe("DRAFT");
	});

	it("formats ISO date strings as de-DE dates", () => {
		expect(
			formatChangeValue("Appointment", "startDate", "2026-03-05T10:00:00.000Z"),
		).toBe("05.03.2026");
	});

	it("leaves non-date strings untouched", () => {
		expect(formatChangeValue("Appointment", "location", "Berlin")).toBe(
			"Berlin",
		);
	});

	it("joins arrays", () => {
		expect(formatChangeValue("Appointment", "labels", ["A", "B"])).toBe("A, B");
		expect(formatChangeValue("Appointment", "labels", [])).toBe("—");
	});

	it("stringifies non-string values", () => {
		expect(formatChangeValue("Appointment", "someField", 42)).toBe("42");
		expect(formatChangeValue("Appointment", "someField", true)).toBe("true");
	});
});

describe("auditActionBadge", () => {
	it("returns a success badge for CREATE", () => {
		expect(auditActionBadge(AuditAction.CREATE)).toEqual({
			label: "Erstellt",
			variant: "success",
		});
	});

	it("returns a destructive badge for DELETE", () => {
		expect(auditActionBadge(AuditAction.DELETE)).toEqual({
			label: "Gelöscht",
			variant: "destructive",
		});
	});

	it("returns a success badge for RESTORE", () => {
		expect(auditActionBadge(AuditAction.RESTORE)).toEqual({
			label: "Wiederhergestellt",
			variant: "success",
		});
	});

	it("returns an info badge for UPDATE", () => {
		expect(auditActionBadge(AuditAction.UPDATE)).toEqual({
			label: "Geändert",
			variant: "info",
		});
	});
});

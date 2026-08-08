import { describe, expect, it } from "vitest";
import { t } from "./text";

describe("t (translation function)", () => {
	it("should return translated text for known keys", () => {
		expect(t("Accept")).toBe("Annehmen");
		expect(t("Decline")).toBe("Ablehnen");
		expect(t("Login")).toBe("Anmelden");
		expect(t("Logout")).toBe("Abmelden");
	});

	it("should return key with penguin emoji for unknown keys", () => {
		expect(t("UnknownKey")).toBe("UnknownKey 🐧");
		expect(t("Another Unknown Key")).toBe("Another Unknown Key 🐧");
	});

	it("should replace single placeholder", () => {
		const result = t("{0} Appointments created", "5");
		expect(result).toBe("5 Termine erstellt");
	});

	it("should handle keys with placeholders", () => {
		const result = t("Are you sure you want to delete this appointment?");
		expect(result).toBe(
			"Bist du sicher, dass du diesen Termin löschen möchtest?",
		);
	});

	it("should handle empty parameters", () => {
		const result = t("Login");
		expect(result).toBe("Anmelden");
	});

	it("should handle multiple words in key", () => {
		expect(t("Next month")).toBe("Nächster Monat");
		expect(t("New Appointment")).toBe("Neuer Termin");
	});

	it("should work with both translated and placeholder text", () => {
		const result = t("{0} Appointments created", "10");
		expect(result).toBe("10 Termine erstellt");
	});

	it("should translate bulk appointment action labels", () => {
		expect(t("Publish")).toBe("Veröffentlichen");
		expect(t("Unpublish")).toBe("Zurückziehen");
		expect(t("Duplicate")).toBe("Duplizieren");
		expect(t("Restore")).toBe("Wiederherstellen");
		expect(t("Clear selection")).toBe("Auswahl aufheben");
	});

	it("should format bulk appointment action result messages", () => {
		expect(t("{0} appointments published", "3")).toBe(
			"3 Termine veröffentlicht",
		);
		expect(t("{0} appointments unpublished", "2")).toBe(
			"2 Termine zurückgezogen",
		);
		expect(t("{0} appointments duplicated", "1")).toBe("1 Termine dupliziert");
		expect(t("{0} appointments restored", "4")).toBe(
			"4 Termine wiederhergestellt",
		);
		expect(t("{0} appointments deleted", "5")).toBe("5 Termine gelöscht");
		expect(t("{0} appointments answered", "2")).toBe("2 Termine beantwortet");
	});

	it("should format the selection count, with a singular form for one", () => {
		expect(t("1 appointment selected")).toBe("1 Termin ausgewählt");
		expect(t("{0} appointments selected", "3")).toBe("3 Termine ausgewählt");
	});

	it("should have singular forms for the holiday import and journal field counts", () => {
		expect(t("1 appointment created")).toBe("1 Termin erstellt");
		expect(t("{0} Appointments created", "3")).toBe("3 Termine erstellt");
		expect(t("1 field changed")).toBe("1 Feld geändert");
		expect(t("{0} fields changed", "2")).toBe("2 Felder geändert");
	});
});

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
});

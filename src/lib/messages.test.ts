import { describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages";

describe("paraglide plural messages", () => {
	it("uses the singular German form for a count of one", () => {
		expect(m.appointments_appointment_created_count({ count: 1 })).toBe(
			"1 Termin erstellt",
		);
	});

	it("uses the plural German form for counts other than one", () => {
		expect(m.appointments_appointment_created_count({ count: 3 })).toBe(
			"3 Termine erstellt",
		);
		expect(m.appointments_appointment_created_count({ count: 0 })).toBe(
			"0 Termine erstellt",
		);
	});
});

describe("paraglide interpolated messages", () => {
	it("substitutes named parameters", () => {
		expect(m.appointments_n_of_n_events({ param1: "3", param2: "10" })).toBe(
			"3 von 10 Ereignissen",
		);
	});
});

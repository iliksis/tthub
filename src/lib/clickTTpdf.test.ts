import { describe, expect, it } from "vitest";
import {
	createTeamMatchAppointmentId,
	parseClickTTMatchDate,
} from "./clickTTpdf";

describe("createTeamMatchAppointmentId", () => {
	it("is deterministic for the same inputs", () => {
		const a = createTeamMatchAppointmentId(
			"524271",
			"SB Versbach",
			"SV 73 Langendorf",
		);
		const b = createTeamMatchAppointmentId(
			"524271",
			"SB Versbach",
			"SV 73 Langendorf",
		);
		expect(a).toBe(b);
	});

	it("differs when the group id, home, or away team differs", () => {
		const base = createTeamMatchAppointmentId(
			"524271",
			"SB Versbach",
			"SV 73 Langendorf",
		);
		expect(
			createTeamMatchAppointmentId("999999", "SB Versbach", "SV 73 Langendorf"),
		).not.toBe(base);
		expect(
			createTeamMatchAppointmentId("524271", "SV 73 Langendorf", "SB Versbach"),
		).not.toBe(base);
		expect(
			createTeamMatchAppointmentId("524271", "SB Versbach", "TSV Sonstwo"),
		).not.toBe(base);
	});
});

describe("parseClickTTMatchDate", () => {
	it("combines the date and time into a local Date", () => {
		const date = parseClickTTMatchDate({
			away: "SB Versbach",
			date: "So. 20.09.2026",
			home: "SV 73 Langendorf",
			time: "11:00",
		});
		expect(date.getFullYear()).toBe(2026);
		expect(date.getMonth()).toBe(8);
		expect(date.getDate()).toBe(20);
		expect(date.getHours()).toBe(11);
		expect(date.getMinutes()).toBe(0);
	});

	it("throws on an unrecognized date format", () => {
		expect(() =>
			parseClickTTMatchDate({
				away: "SB Versbach",
				date: "not a date",
				home: "SV 73 Langendorf",
				time: "11:00",
			}),
		).toThrow();
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IcalAppointment, IcalGenerator } from "./ical";
import { catppuccinLatteHex } from "./labelColor";
import type { Appointment } from "./prisma/client";
import { AppointmentStatus, AppointmentType } from "./prisma/enums";

describe("IcalGenerator", () => {
	let generator: IcalGenerator;

	beforeEach(() => {
		generator = new IcalGenerator("https://example.com");
		// Mock Date to ensure consistent output
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-17T12:00:00Z"));
	});

	describe("createAndDownloadIcalFile", () => {
		it("should create valid iCal format", () => {
			const mockLink = {
				click: vi.fn(),
				download: "",
				href: "",
			};

			const createElementSpy = vi.spyOn(document, "createElement");
			createElementSpy.mockReturnValue(mockLink as any);

			global.Blob = class MockBlob {
				constructor(
					public parts: any[],
					public options?: any,
				) {}
			} as any;

			const appointment: Appointment = {
				awayTeam: null,
				createdAt: new Date(),
				deletedAt: null,
				endDate: new Date("2026-01-20T11:00:00Z"),
				homeTeam: null,
				id: "appt-123",
				link: null,
				location: "Test Location",
				nextAppointmentId: null,
				ownTeamId: null,
				seasonId: null,
				startDate: new Date("2026-01-20T10:00:00Z"),
				status: AppointmentStatus.PUBLISHED,
				title: "Test Event",
				type: AppointmentType.TOURNAMENT,
			};

			generator.createAndDownloadIcalFile(appointment);

			expect(createElementSpy).toHaveBeenCalledWith("a");
			expect(mockLink.click).toHaveBeenCalled();
			expect(mockLink.download).toMatch(/^tthub-\d+\.ics$/);
		});

		it("should handle multiple appointments", () => {
			const mockLink = {
				click: vi.fn(),
				download: "",
				href: "",
			};

			const createElementSpy = vi.spyOn(document, "createElement");
			createElementSpy.mockReturnValue(mockLink as any);

			global.Blob = class MockBlob {
				constructor(
					public parts: any[],
					public options?: any,
				) {}
			} as any;

			const appointment1: Appointment = {
				awayTeam: null,
				createdAt: new Date(),
				deletedAt: null,
				endDate: null,
				homeTeam: null,
				id: "appt-1",
				link: null,
				location: "Location 1",
				nextAppointmentId: null,
				ownTeamId: null,
				seasonId: null,
				startDate: new Date("2026-01-20T10:00:00Z"),
				status: AppointmentStatus.PUBLISHED,
				title: "Event 1",
				type: AppointmentType.TOURNAMENT,
			};

			const appointment2: Appointment = {
				awayTeam: null,
				createdAt: new Date(),
				deletedAt: null,
				endDate: null,
				homeTeam: null,
				id: "appt-2",
				link: null,
				location: "Location 2",
				nextAppointmentId: null,
				ownTeamId: null,
				seasonId: null,
				startDate: new Date("2026-01-21T10:00:00Z"),
				status: AppointmentStatus.PUBLISHED,
				title: "Event 2",
				type: AppointmentType.TOURNAMENT,
			};

			generator.createAndDownloadIcalFile(appointment1, appointment2);

			expect(mockLink.click).toHaveBeenCalled();
		});
	});

	describe("COLOR property", () => {
		const baseAppointment: Appointment = {
			awayTeam: null,
			createdAt: new Date(),
			deletedAt: null,
			endDate: new Date("2026-01-20T11:00:00Z"),
			homeTeam: null,
			id: "appt-color",
			link: null,
			location: "Test Location",
			nextAppointmentId: null,
			ownTeamId: null,
			seasonId: null,
			startDate: new Date("2026-01-20T10:00:00Z"),
			status: AppointmentStatus.PUBLISHED,
			title: "Test Event",
			type: AppointmentType.TOURNAMENT,
		};

		it("emits no COLOR property for an appointment with no labels", () => {
			const ical = generator.createIcalString(baseAppointment);
			expect(ical).not.toContain("COLOR:");
		});

		it("emits COLOR from the highest-priority (lowest priority value) label", () => {
			const appointment: IcalAppointment = {
				...baseAppointment,
				labels: [
					{ label: { color: "peach", priority: 5 } },
					{ label: { color: "mauve", priority: 0 } },
				],
			};
			const ical = generator.createIcalString(appointment);
			expect(ical).toContain(`COLOR:${catppuccinLatteHex.mauve}`);
			expect(ical).not.toContain(catppuccinLatteHex.peach);
		});

		it("emits COLOR for a single labeled appointment", () => {
			const appointment: IcalAppointment = {
				...baseAppointment,
				labels: [{ label: { color: "blue", priority: 0 } }],
			};
			const ical = generator.createIcalString(appointment);
			expect(ical).toContain(`COLOR:${catppuccinLatteHex.blue}`);
		});
	});

	describe("template", () => {
		it("should have correct CRLF line endings", () => {
			expect(generator.template).toContain("\r\n");
			expect(generator.template).toMatch(/BEGIN:VCALENDAR\r\n/);
			// Template contains CRLF line breaks throughout
			expect(generator.template).toContain("END:VEVENT\r\n");
		});

		it("should contain all required iCal fields", () => {
			expect(generator.template).toContain("BEGIN:VCALENDAR");
			expect(generator.template).toContain("CALSCALE:GREGORIAN");
			expect(generator.template).toContain("METHOD:PUBLISH");
			expect(generator.template).toContain("VERSION:2.0");
			expect(generator.template).toContain("BEGIN:VEVENT");
			expect(generator.template).toContain("DTSTAMP");
			expect(generator.template).toContain("DTSTART");
			expect(generator.template).toContain("SUMMARY");
			expect(generator.template).toContain("END:VEVENT");
			expect(generator.template).toContain("END:VCALENDAR");
		});
	});
});

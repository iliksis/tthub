// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { AppointmentStatus, AppointmentType } from "@/lib/prisma/enums";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import { AppointmentsApi } from "./appointments.server";
import { ForbiddenError, NotFoundError } from "./kernel.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(AppointmentsApi, { role });
	cleanup = t.cleanup;
	return t;
};
type Db = Awaited<ReturnType<typeof setup>>["db"];

// Noon `days` from today, so "today or later" filters are stable across the
// day.
const daysFromNow = (days: number) => {
	const d = new Date();
	d.setHours(12, 0, 0, 0);
	d.setDate(d.getDate() + days);
	return d;
};

type Seed = {
	title?: string;
	type?: AppointmentType;
	startDate?: Date;
	endDate?: Date | null;
	location?: string | null;
	seasonId?: string | null;
	ownTeamId?: string | null;
	deletedAt?: Date | null;
	status?: AppointmentStatus | null;
};
const seedAppointment = (db: Db, over: Seed = {}) =>
	db.appointment.create({
		data: {
			startDate: daysFromNow(3),
			title: "Kreismeisterschaft",
			type: "TOURNAMENT",
			...over,
		},
	});

const seedUser = (db: Db, userName: string) =>
	db.user.create({
		data: { name: userName, password: "secret-hash", userName },
	});

describe("AppointmentsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(AppointmentsApi.policy).toMatchInlineSnapshot(`
			{
			  "acceptedBy": "AUTHENTICATED",
			  "calendar": "AUTHENTICATED",
			  "create": "EDITOR",
			  "get": "AUTHENTICATED",
			  "list": "AUTHENTICATED",
			  "next": "AUTHENTICATED",
			  "openFor": "AUTHENTICATED",
			  "page": "AUTHENTICATED",
			  "publish": "EDITOR",
			  "respond": "AUTHENTICATED",
			  "search": "AUTHENTICATED",
			  "unpublish": "EDITOR",
			  "update": "EDITOR",
			}
		`);
	});

	it("denies anonymous callers responding and writes nothing", async () => {
		const { api, db } = await setup(null);
		const appointment = await seedAppointment(db);
		await expect(api.respond(appointment.id, "ACCEPT")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(await db.response.count()).toBe(0);
	});

	it("denies anonymous callers listing the next appointments", async () => {
		const { api } = await setup(null);
		await expect(api.next()).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("AppointmentsApi.get", () => {
	it("returns the detail with audit entries and no credentials", async () => {
		const { api, db, user } = await setup("EDITOR");
		const appointment = await seedAppointment(db);
		const other = await seedUser(db, "anna");
		await db.response.create({
			data: {
				appointmentId: appointment.id,
				responseType: "ACCEPT",
				userId: other.id,
			},
		});
		await db.auditLog.create({
			data: {
				action: "CREATE",
				entityId: appointment.id,
				entityType: "Appointment",
				userId: user?.id,
			},
		});

		const detail = await api.get(appointment.id);
		expect(detail.id).toBe(appointment.id);
		expect(detail.responses.map((r) => r.user.name)).toEqual(["anna"]);
		expect(detail.auditLog.map((e) => e.action)).toEqual(["CREATE"]);
		expectNoCredentials(detail);
	});

	it.each([
		["USER", false],
		["EDITOR", true],
	] as const)("shows player flags to a %s: %s", async (role, visible) => {
		const { api, db } = await setup(role);
		const appointment = await seedAppointment(db);
		const player = await db.player.create({
			data: {
				isClubMember: true,
				isEligibleToPlay: true,
				name: "Anna",
				qttr: 1500,
				year: 2001,
			},
		});
		await db.placement.create({
			data: {
				appointmentId: appointment.id,
				category: "Damen",
				playerId: player.id,
			},
		});

		const [placement] = (await api.get(appointment.id)).placements;
		expect(placement.player.isClubMember).toBe(visible);
		expect(placement.player.isEligibleToPlay).toBe(visible);
	});

	it("throws NotFoundError for an unknown id", async () => {
		const { api } = await setup("USER");
		const error = await api.get("nope").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NotFoundError);
		expect((error as Error).message).toBe(
			m.appointments_appointment_not_found(),
		);
	});
});

describe("AppointmentsApi lists", () => {
	it("searches active non-holiday appointments by title or location, newest first, at most 10", async () => {
		const { api, db } = await setup("USER");
		for (let i = 0; i < 11; i++) {
			await seedAppointment(db, { startDate: daysFromNow(i), title: `T${i}` });
		}
		await seedAppointment(db, { location: "Bonn", title: "Pokal" });
		await seedAppointment(db, { deletedAt: new Date(), title: "Bonn alt" });
		await seedAppointment(db, { title: "Bonn frei", type: "HOLIDAY" });

		const all = await api.search(undefined);
		expect(all).toHaveLength(10);
		expect(all[0].title).toBe("T10");
		expect((await api.search("Bonn")).map((a) => a.title)).toEqual(["Pokal"]);
	});

	it("lists tournaments by filter, optionally with deleted ones", async () => {
		const { api, db } = await setup("USER");
		await seedAppointment(db, { startDate: daysFromNow(1), title: "A" });
		await seedAppointment(db, { startDate: daysFromNow(2), title: "B" });
		await seedAppointment(db, { deletedAt: new Date(), title: "C" });
		await seedAppointment(db, { title: "Ferien", type: "HOLIDAY" });

		const titles = async (filter: Parameters<typeof api.list>[0]) =>
			(await api.list(filter)).map((a) => a.title);
		expect(await titles({ orderBy: { startDate: "asc" } })).toEqual(["A", "B"]);
		expect(await titles({ minDate: daysFromNow(1) })).toEqual(["B"]);
		expect((await titles({ withDeleted: true })).sort()).toEqual([
			"A",
			"B",
			"C",
		]);
	});

	it("pages upcoming appointments by the actor's response", async () => {
		const { api, db, user } = await setup("USER");
		const accepted = await seedAppointment(db, {
			startDate: daysFromNow(1),
			title: "Zugesagt",
		});
		await seedAppointment(db, { startDate: daysFromNow(2), title: "Offen" });
		await seedAppointment(db, { startDate: daysFromNow(-2), title: "Vorbei" });
		await seedAppointment(db, { title: "Ferien", type: "HOLIDAY" });
		await db.response.create({
			data: {
				appointmentId: accepted.id,
				responseType: "ACCEPT",
				userId: user?.id ?? "",
			},
		});

		const page = async (responses: ("ACCEPT" | "NONE")[]) => {
			const res = await api.page({ responses, skip: 0, take: 10 });
			return {
				grandTotal: res.grandTotal,
				matchedTotal: res.matchedTotal,
				titles: res.appointments.map((a) => a.title),
			};
		};
		expect(await page([])).toEqual({
			grandTotal: 2,
			matchedTotal: 2,
			titles: ["Zugesagt", "Offen"],
		});
		expect(await page(["ACCEPT"])).toMatchObject({ titles: ["Zugesagt"] });
		expect(await page(["NONE"])).toMatchObject({ titles: ["Offen"] });
		expect(await page(["ACCEPT", "NONE"])).toMatchObject({
			matchedTotal: 2,
		});
	});

	it("pages by type, team, text and sort direction; mixed response filters return both", async () => {
		const { api, db, user } = await setup("USER");
		const season = await db.season.create({ data: { name: "2026/27" } });
		const team = await db.team.create({
			data: { seasonId: season.id, title: "Herren I" },
		});
		await seedAppointment(db, {
			ownTeamId: team.id,
			startDate: daysFromNow(1),
			title: "Spiel",
			type: "TEAM_MATCH",
		});
		const declined = await seedAppointment(db, {
			location: "Bonn",
			startDate: daysFromNow(2),
			title: "Turnier",
		});
		await db.response.create({
			data: {
				appointmentId: declined.id,
				responseType: "DECLINE",
				userId: user?.id ?? "",
			},
		});

		const titles = async (filter: Partial<Parameters<typeof api.page>[0]>) =>
			(await api.page({ skip: 0, take: 10, ...filter })).appointments.map(
				(a) => a.title,
			);
		expect(await titles({ typeGroup: "TEAM_MATCH" })).toEqual(["Spiel"]);
		expect(await titles({ teamIds: [team.id] })).toEqual(["Spiel"]);
		expect(await titles({ query: "Bonn" })).toEqual(["Turnier"]);
		expect(await titles({ sortDir: "desc" })).toEqual(["Turnier", "Spiel"]);
		expect(await titles({ responses: ["DECLINE", "NONE"] })).toEqual([
			"Spiel",
			"Turnier",
		]);
	});

	it("lists the next four weeks of active non-holiday appointments", async () => {
		const { api, db } = await setup("USER");
		await seedAppointment(db, { startDate: daysFromNow(5), title: "Bald" });
		await seedAppointment(db, { startDate: daysFromNow(1), title: "Morgen" });
		await seedAppointment(db, { startDate: daysFromNow(40), title: "Später" });
		await seedAppointment(db, { startDate: daysFromNow(-1), title: "Gestern" });
		await seedAppointment(db, { deletedAt: new Date(), title: "Gelöscht" });
		await seedAppointment(db, { title: "Ferien", type: "HOLIDAY" });

		expect((await api.next()).map((a) => a.title)).toEqual(["Morgen", "Bald"]);
	});

	it("lists a user's accepted and open upcoming tournaments", async () => {
		const { api, db } = await setup("USER");
		const anna = await seedUser(db, "anna");
		const accepted = await seedAppointment(db, { title: "Zugesagt" });
		const maybe = await seedAppointment(db, { title: "Vielleicht" });
		const declined = await seedAppointment(db, { title: "Abgesagt" });
		await seedAppointment(db, { title: "Offen" });
		await seedAppointment(db, { startDate: daysFromNow(-3), title: "Vorbei" });
		for (const [appointment, responseType] of [
			[accepted, "ACCEPT"],
			[maybe, "MAYBE"],
			[declined, "DECLINE"],
		] as const) {
			await db.response.create({
				data: { appointmentId: appointment.id, responseType, userId: anna.id },
			});
		}

		expect((await api.acceptedBy(anna.id)).map((a) => a.title)).toEqual([
			"Zugesagt",
		]);
		expect((await api.openFor(anna.id)).map((a) => a.title).sort()).toEqual([
			"Offen",
			"Vielleicht",
		]);
	});

	it("maps appointments overlapping a range to calendar entries", async () => {
		const { api, db } = await setup("USER");
		const label = await db.label.create({
			data: { color: "red", name: "Wichtig" },
		});
		const multiDay = await seedAppointment(db, {
			endDate: daysFromNow(2),
			startDate: daysFromNow(-2),
			title: "Mehrtägig",
		});
		await db.appointmentLabel.create({
			data: { appointmentId: multiDay.id, labelId: label.id },
		});
		await seedAppointment(db, {
			startDate: daysFromNow(1),
			title: "Ferien",
			type: "HOLIDAY",
		});
		await seedAppointment(db, { startDate: daysFromNow(-5), title: "Vorher" });
		await seedAppointment(db, { startDate: daysFromNow(10), title: "Danach" });

		const entries = await api.calendar({
			end: daysFromNow(5),
			start: daysFromNow(0),
		});
		expect(entries.map((e) => e.title).sort()).toEqual(["Ferien", "Mehrtägig"]);
		const ferien = entries.find((e) => e.title === "Ferien");
		expect(ferien?.end).toEqual(ferien?.start);
		expect(entries.find((e) => e.id === multiDay.id)?.labels).toEqual([
			expect.objectContaining({ name: "Wichtig" }),
		]);
	});
});

describe("AppointmentsApi.respond", () => {
	it("records the actor's response and changes it on a second call", async () => {
		const { api, db, user } = await setup("USER");
		const appointment = await seedAppointment(db);

		await api.respond(appointment.id, "MAYBE");
		const response = await api.respond(appointment.id, "ACCEPT");

		expect(response).toEqual({
			appointmentId: appointment.id,
			responseType: "ACCEPT",
			userId: user?.id,
		});
		expect(await db.response.count()).toBe(1);
	});

	it("throws NotFoundError for a deleted appointment and writes nothing", async () => {
		const { api, db } = await setup("USER");
		const appointment = await seedAppointment(db, { deletedAt: new Date() });

		const error = await api
			.respond(appointment.id, "ACCEPT")
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NotFoundError);
		expect((error as Error).message).toBe(
			m.appointments_appointment_not_found(),
		);
		expect(await db.response.count()).toBe(0);
	});
});

const auditRows = (db: Db, entityId: string) =>
	db.auditLog.findMany({
		orderBy: { createdAt: "asc" },
		where: { entityId, entityType: "Appointment" },
	});

describe("AppointmentsApi.create", () => {
	it("creates a published tournament with labels, journals it and notifies", async () => {
		const { api, db, notifications, user } = await setup("EDITOR");
		const season = await db.season.create({ data: { name: "2026/27" } });
		const label = await db.label.create({
			data: { color: "red", name: "Wichtig" },
		});

		const appointment = await api.create({
			endDate: null,
			labelIds: [label.id],
			location: "Bonn",
			seasonId: season.id,
			startDate: daysFromNow(3),
			status: "PUBLISHED",
			title: "Pokal",
			type: "TOURNAMENT",
		});

		expect(appointment).toMatchObject({
			location: "Bonn",
			seasonId: season.id,
			status: "PUBLISHED",
			title: "Pokal",
		});
		expect(
			await db.appointmentLabel.findMany({
				where: { appointmentId: appointment.id },
			}),
		).toEqual([{ appointmentId: appointment.id, labelId: label.id }]);
		expect(await auditRows(db, appointment.id)).toMatchObject([
			{ action: "CREATE", userId: user?.id },
		]);
		expect(notifications).toEqual([
			{ actorId: user?.id, id: appointment.id, kind: "published" },
		]);
	});

	it("creates a draft tournament or a holiday without notifying", async () => {
		const { api, db, notifications } = await setup("EDITOR");
		const season = await db.season.create({ data: { name: "2026/27" } });

		await api.create({
			endDate: null,
			labelIds: [],
			location: null,
			seasonId: season.id,
			startDate: daysFromNow(3),
			status: "DRAFT",
			title: "Entwurf",
			type: "TOURNAMENT",
		});
		const holiday = await api.create({
			endDate: daysFromNow(10),
			startDate: daysFromNow(3),
			title: "Ferien",
			type: "HOLIDAY",
		});

		expect(holiday).toMatchObject({ seasonId: null, type: "HOLIDAY" });
		expect(await db.auditLog.count({ where: { action: "CREATE" } })).toBe(2);
		expect(notifications).toEqual([]);
	});

	it("denies a USER and writes nothing", async () => {
		const { api, db } = await setup("USER");
		await expect(
			api.create({
				endDate: null,
				startDate: daysFromNow(3),
				title: "Ferien",
				type: "HOLIDAY",
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.appointment.count()).toBe(0);
	});
});

describe("AppointmentsApi.update", () => {
	it("journals only the saved fields that changed and notifies for a tournament", async () => {
		const { api, db, notifications, user } = await setup("EDITOR");
		const appointment = await seedAppointment(db, { location: "Bonn" });

		const updated = await api.update(appointment.id, {
			location: "Bonn",
			title: "Bezirksmeisterschaft",
		});

		expect(updated.title).toBe("Bezirksmeisterschaft");
		expect(await auditRows(db, appointment.id)).toMatchObject([
			{
				action: "UPDATE",
				changes: {
					title: { new: "Bezirksmeisterschaft", old: "Kreismeisterschaft" },
				},
				userId: user?.id,
			},
		]);
		expect(notifications).toEqual([
			{ actorId: user?.id, id: appointment.id, kind: "updated" },
		]);
	});

	it("replaces labels and journals them by name", async () => {
		const { api, db } = await setup("EDITOR");
		const appointment = await seedAppointment(db);
		const [alt, neu] = await Promise.all([
			db.label.create({ data: { color: "red", name: "Alt" } }),
			db.label.create({ data: { color: "blue", name: "Neu" } }),
		]);
		await db.appointmentLabel.create({
			data: { appointmentId: appointment.id, labelId: alt.id },
		});

		await api.update(appointment.id, { labelIds: [neu.id] });

		expect(
			await db.appointmentLabel.findMany({
				where: { appointmentId: appointment.id },
			}),
		).toEqual([{ appointmentId: appointment.id, labelId: neu.id }]);
		expect(await auditRows(db, appointment.id)).toMatchObject([
			{ changes: { labels: { new: ["Neu"], old: ["Alt"] } } },
		]);
	});

	it("journals nothing when labels are saved unchanged, and ignores non-editable fields", async () => {
		const { api, db } = await setup("EDITOR");
		const appointment = await seedAppointment(db);
		const label = await db.label.create({
			data: { color: "red", name: "Alt" },
		});
		await db.appointmentLabel.create({
			data: { appointmentId: appointment.id, labelId: label.id },
		});

		const updated = await api.update(appointment.id, {
			labelIds: [label.id],
			type: "HOLIDAY",
		});

		expect(updated.type).toBe("TOURNAMENT");
		expect(await auditRows(db, appointment.id)).toEqual([]);
	});

	it("does not notify for a holiday", async () => {
		const { api, db, notifications } = await setup("EDITOR");
		const holiday = await seedAppointment(db, { type: "HOLIDAY" });
		await api.update(holiday.id, { title: "Sommerferien" });
		expect(notifications).toEqual([]);
	});

	it("throws NotFoundError for an unknown id and notifies nobody", async () => {
		const { api, notifications } = await setup("EDITOR");
		const error = await api
			.update("nope", { title: "X" })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(NotFoundError);
		expect((error as Error).message).toBe(
			m.appointments_appointment_not_found(),
		);
		expect(notifications).toEqual([]);
	});
});

describe("AppointmentsApi.publish and unpublish", () => {
	it("publishes a draft tournament, journals the status and notifies once", async () => {
		const { api, db, notifications, user } = await setup("EDITOR");
		const appointment = await seedAppointment(db, { status: "DRAFT" });

		const published = await api.publish(appointment.id);
		await api.publish(appointment.id);

		expect(published.status).toBe("PUBLISHED");
		expect(await auditRows(db, appointment.id)).toMatchObject([
			{
				action: "UPDATE",
				changes: { status: { new: "PUBLISHED", old: "DRAFT" } },
			},
		]);
		expect(notifications).toEqual([
			{ actorId: user?.id, id: appointment.id, kind: "published" },
		]);
	});

	it("does not notify when publishing a team match", async () => {
		const { api, db, notifications } = await setup("EDITOR");
		const match = await seedAppointment(db, { type: "TEAM_MATCH" });
		await api.publish(match.id);
		expect(notifications).toEqual([]);
	});

	it("unpublishes back to draft, journals it and notifies nobody", async () => {
		const { api, db, notifications } = await setup("EDITOR");
		const appointment = await seedAppointment(db, { status: "PUBLISHED" });

		const draft = await api.unpublish(appointment.id);

		expect(draft.status).toBe("DRAFT");
		expect(await auditRows(db, appointment.id)).toMatchObject([
			{ changes: { status: { new: "DRAFT", old: "PUBLISHED" } } },
		]);
		expect(notifications).toEqual([]);
	});

	it("throws NotFoundError when publishing an unknown id", async () => {
		const { api } = await setup("EDITOR");
		await expect(api.publish("nope")).rejects.toBeInstanceOf(NotFoundError);
		await expect(api.unpublish("nope")).rejects.toBeInstanceOf(NotFoundError);
	});

	it("denies a USER publishing and changes nothing", async () => {
		const { api, db } = await setup("USER");
		const appointment = await seedAppointment(db, { status: "DRAFT" });
		await expect(api.publish(appointment.id)).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(
			(
				await db.appointment.findUniqueOrThrow({
					where: { id: appointment.id },
				})
			).status,
		).toBe("DRAFT");
	});
});

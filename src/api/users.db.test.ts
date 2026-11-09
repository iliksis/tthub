// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/db";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import {
	ApiError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "./kernel.server";
import { UsersApi } from "./users.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(UsersApi, { role });
	cleanup = t.cleanup;
	const other = await t.db.user.create({
		data: {
			name: "Other",
			password: await hashPassword("old"),
			userName: "other",
		},
	});
	return { ...t, actorId: t.user?.id ?? "", other };
};

describe("UsersApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(UsersApi.policy).toMatchInlineSnapshot(`
			{
			  "create": "ADMIN",
			  "delete": "ADMIN",
			  "list": "ADMIN",
			  "updateInformation": "AUTHENTICATED",
			  "updateRole": "ADMIN",
			}
		`);
	});

	it("denies an EDITOR listing users", async () => {
		const { api } = await setup("EDITOR");
		await expect(api.list()).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("denies a USER updating someone else's profile and writes nothing", async () => {
		const { api, db, other } = await setup("USER");
		await expect(
			api.updateInformation({
				confirmPassword: "",
				id: other.id,
				name: "Hacked",
				password: "",
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
		const row = await db.user.findUniqueOrThrow({ where: { id: other.id } });
		expect(row.name).toBe("Other");
	});
});

describe("UsersApi.list", () => {
	it("lists users with invitation and reset, without credentials", async () => {
		const { api, db, other } = await setup("ADMIN");
		await db.userInvitation.create({ data: { userId: other.id } });
		const users = await api.list();
		expect(users).toHaveLength(2);
		expectNoCredentials(users);
		const listed = users.find((u) => u.id === other.id);
		expect(listed?.invitation?.userId).toBe(other.id);
		expect(listed?.passwordReset).toBeNull();
	});
});

describe("UsersApi.create", () => {
	it("creates the user with an invitation", async () => {
		const { api, db } = await setup("ADMIN");
		const created = await api.create({
			name: "Neu",
			role: "EDITOR",
			userName: "neu",
		});
		expectNoCredentials(created);
		expect(created).toMatchObject({ name: "Neu", role: "EDITOR" });
		expect(
			await db.userInvitation.count({ where: { userId: created.id } }),
		).toBe(1);
	});

	it("throws ConflictError for a taken user name", async () => {
		const { api, db } = await setup("ADMIN");
		const call = api.create({ name: "X", role: "USER", userName: "other" });
		await expect(call).rejects.toBeInstanceOf(ConflictError);
		await expect(call).rejects.toThrow(m.users_user_name_taken());
		expect(await db.user.count()).toBe(2);
	});
});

describe("UsersApi.updateRole", () => {
	it("changes another user's role", async () => {
		const { api, other } = await setup("ADMIN");
		const updated = await api.updateRole(other.id, "EDITOR");
		expectNoCredentials(updated);
		expect(updated.role).toBe("EDITOR");
	});

	it("refuses to change the actor's own role", async () => {
		const { actorId, api, db } = await setup("ADMIN");
		const call = api.updateRole(actorId, "USER");
		await expect(call).rejects.toBeInstanceOf(ApiError);
		await expect(call).rejects.toThrow(
			m.users_you_cannot_change_your_own_role(),
		);
		const row = await db.user.findUniqueOrThrow({ where: { id: actorId } });
		expect(row.role).toBe("ADMIN");
	});

	it("throws NotFoundError for an unknown user", async () => {
		const { api } = await setup("ADMIN");
		await expect(api.updateRole("nope", "USER")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});
});

describe("UsersApi.updateInformation", () => {
	it("lets users rename themselves and change their password", async () => {
		const { actorId, api, db } = await setup("USER");
		const updated = await api.updateInformation({
			confirmPassword: "new",
			id: actorId,
			name: "Renamed",
			password: "new",
		});
		expectNoCredentials(updated);
		expect(updated.name).toBe("Renamed");
		const row = await db.user.findUniqueOrThrow({ where: { id: actorId } });
		expect(row.password).toBe(await hashPassword("new"));
	});

	it("keeps the password when none is entered", async () => {
		const { api, db, other } = await setup("ADMIN");
		await api.updateInformation({
			confirmPassword: "",
			id: other.id,
			name: "Renamed",
			password: "",
		});
		const row = await db.user.findUniqueOrThrow({ where: { id: other.id } });
		expect(row).toMatchObject({
			name: "Renamed",
			password: await hashPassword("old"),
		});
	});

	it("rejects mismatched passwords and changes nothing", async () => {
		const { actorId, api, db } = await setup("USER");
		await expect(
			api.updateInformation({
				confirmPassword: "b",
				id: actorId,
				name: "Renamed",
				password: "a",
			}),
		).rejects.toThrow(m.common_the_passwords_entered_do_not_match());
		const row = await db.user.findUniqueOrThrow({ where: { id: actorId } });
		expect(row.name).toBe("Test USER");
	});
});

describe("UsersApi.delete", () => {
	it("deletes the user and everything that blocks the delete", async () => {
		const { api, db, other } = await setup("ADMIN");
		const appointment = await db.appointment.create({
			data: { startDate: new Date(), title: "T", type: "TOURNAMENT" },
		});
		await db.response.create({
			data: {
				appointmentId: appointment.id,
				responseType: "ACCEPT",
				userId: other.id,
			},
		});
		await db.userInvitation.create({ data: { userId: other.id } });
		await db.passwordReset.create({ data: { userId: other.id } });
		await db.subscription.create({
			data: {
				auth: "a",
				device: "d",
				endpoint: "e",
				notificationSettings: {
					create: {
						changedAppointment: true,
						newAppointment: true,
						userId: other.id,
					},
				},
				p256dh: "p",
				userId: other.id,
			},
		});

		await api.delete(other.id);
		expect(await db.user.findUnique({ where: { id: other.id } })).toBeNull();
		expect(await db.response.count()).toBe(0);
		expect(await db.subscription.count()).toBe(0);
		expect(await db.appointment.count()).toBe(1);
	});

	it("throws NotFoundError for an unknown user", async () => {
		const { api } = await setup("ADMIN");
		await expect(api.delete("nope")).rejects.toBeInstanceOf(NotFoundError);
	});
});

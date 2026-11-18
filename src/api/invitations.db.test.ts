// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/db";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import { InvitationsApi } from "./invitations.server";
import { ApiError, ForbiddenError, NotFoundError } from "./kernel.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(InvitationsApi, { role });
	cleanup = t.cleanup;
	const invitee = await t.db.user.create({
		data: { invitation: { create: {} }, name: "Neu", userName: "neu" },
		include: { invitation: true },
	});
	// biome-ignore lint/style/noNonNullAssertion: created just above
	return { ...t, invitation: invitee.invitation!, invitee };
};

const expire = (db: Awaited<ReturnType<typeof setup>>["db"], id: string) =>
	db.userInvitation.update({
		data: { createdAt: new Date("2020-01-01") },
		where: { id },
	});

describe("InvitationsApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(InvitationsApi.policy).toMatchInlineSnapshot(`
			{
			  "accept": "PUBLIC",
			  "create": "ADMIN",
			  "get": "PUBLIC",
			}
		`);
	});

	it("denies a non-admin creating an invitation", async () => {
		const { api, db, invitee, invitation } = await setup("EDITOR");
		await expect(api.create(invitee.id)).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.userInvitation.findMany()).toEqual([invitation]);
	});
});

describe("InvitationsApi.get", () => {
	it("returns only what the invite page needs", async () => {
		const { api, invitation } = await setup(null);
		const result = await api.get(invitation.id);
		expect(result).toEqual({
			createdAt: invitation.createdAt,
			id: invitation.id,
			user: { userName: "neu" },
		});
		expectNoCredentials(result);
	});

	it("throws NotFoundError for an unknown token", async () => {
		const { api } = await setup(null);
		const call = api.get("nope");
		await expect(call).rejects.toBeInstanceOf(NotFoundError);
		await expect(call).rejects.toThrow(m.common_invitation_not_found());
	});

	it("throws for an expired invitation", async () => {
		const { api, db, invitation } = await setup(null);
		await expire(db, invitation.id);
		await expect(api.get(invitation.id)).rejects.toThrow(
			m.common_invitation_expired(),
		);
	});
});

describe("InvitationsApi.create", () => {
	it("replaces the user's invitation with a fresh one", async () => {
		const { api, db, invitee, invitation } = await setup("ADMIN");
		const created = await api.create(invitee.id);
		expect(created.id).not.toBe(invitation.id);
		expect(created.userId).toBe(invitee.id);
		expect(await db.userInvitation.findMany()).toEqual([created]);
	});

	it("works for a user without an invitation", async () => {
		const { api, db, user } = await setup("ADMIN");
		const userId = user?.id ?? "";
		const created = await api.create(userId);
		expect(created.userId).toBe(userId);
		expect(await db.userInvitation.count()).toBe(2);
	});

	it("throws NotFoundError for an unknown user", async () => {
		const { api } = await setup("ADMIN");
		await expect(api.create("nope")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("InvitationsApi.accept", () => {
	it("sets the password, consumes the token and signs the user in", async () => {
		const { api, db, invitee, invitation, session } = await setup(null);
		const result = await api.accept(invitation.id, "pw", "pw");
		const view = {
			id: invitee.id,
			name: "Neu",
			role: "USER",
			userName: "neu",
		};
		expect(result).toEqual(view);
		expectNoCredentials(result);
		expect(session.stored).toEqual(view);
		expect(await db.userInvitation.count()).toBe(0);
		const row = await db.user.findUniqueOrThrow({ where: { id: invitee.id } });
		expect(row.password).toBe(await hashPassword("pw"));
	});

	it("rejects mismatched passwords and keeps the token", async () => {
		const { api, db, invitation, session } = await setup(null);
		const call = api.accept(invitation.id, "a", "b");
		await expect(call).rejects.toBeInstanceOf(ApiError);
		await expect(call).rejects.toThrow(
			m.common_the_passwords_entered_do_not_match(),
		);
		expect(await db.userInvitation.count()).toBe(1);
		expect(session.stored).toBeNull();
	});

	it("rejects an expired invitation", async () => {
		const { api, db, invitation } = await setup(null);
		await expire(db, invitation.id);
		await expect(api.accept(invitation.id, "pw", "pw")).rejects.toThrow(
			m.common_invitation_expired(),
		);
	});
});

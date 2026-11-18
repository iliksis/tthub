// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/db";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import { AuthApi } from "./auth.server";
import { ApiError } from "./kernel.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(AuthApi, { role });
	cleanup = t.cleanup;
	return t;
};

describe("AuthApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(AuthApi.policy).toMatchInlineSnapshot(`
			{
			  "currentUser": "PUBLIC",
			  "login": "PUBLIC",
			  "logout": "PUBLIC",
			}
		`);
	});
});

describe("AuthApi.login", () => {
	it("stores only the SessionUser fields and returns them", async () => {
		const { api, db, session } = await setup(null);
		const row = await db.user.create({
			data: {
				name: "Alice",
				password: await hashPassword("secret"),
				role: "EDITOR",
				userName: "alice",
			},
		});
		const result = await api.login("alice", "secret");
		const expected = {
			id: row.id,
			name: "Alice",
			role: "EDITOR",
			userName: "alice",
		};
		expect(result).toEqual(expected);
		expect(session.stored).toEqual(expected);
		expectNoCredentials(result);
	});

	it("rejects a wrong password, clears the session and says why", async () => {
		const { api, db, session } = await setup(null);
		await db.user.create({
			data: {
				name: "Alice",
				password: await hashPassword("secret"),
				userName: "alice",
			},
		});
		const call = api.login("alice", "wrong");
		await expect(call).rejects.toBeInstanceOf(ApiError);
		await expect(call).rejects.toThrow(
			m.auth_incorrect_user_name_or_password(),
		);
		expect(session.stored).toBeNull();
		expect(session.cleared).toBe(1);
	});

	it("rejects unknown users and users who never set a password", async () => {
		const { api, db } = await setup(null);
		await db.user.create({ data: { name: "Invited", userName: "invited" } });
		await expect(api.login("nobody", "x")).rejects.toThrow(
			m.auth_incorrect_user_name_or_password(),
		);
		await expect(api.login("invited", "")).rejects.toThrow(
			m.auth_incorrect_user_name_or_password(),
		);
	});
});

describe("AuthApi.logout", () => {
	it("clears the session", async () => {
		const { api, session } = await setup("USER");
		await api.logout();
		expect(session.stored).toBeNull();
		expect(session.cleared).toBe(1);
	});
});

describe("AuthApi.currentUser", () => {
	it("returns null when anonymous", async () => {
		const { api } = await setup(null);
		await expect(api.currentUser()).resolves.toBeNull();
	});

	it("returns the session user while their row exists", async () => {
		const { api, db, user } = await setup("USER");
		await expect(api.currentUser()).resolves.toEqual(user);
		await db.user.delete({ where: { id: user?.id } });
		await expect(api.currentUser()).resolves.toBeNull();
	});
});

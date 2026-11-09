// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/db";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { createTestApi } from "@/test/testApi";
import { ApiError, ForbiddenError, NotFoundError } from "./kernel.server";
import { PasswordResetApi } from "./passwordReset.server";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
	await cleanup?.();
	cleanup = undefined;
});

const setup = async (role: Parameters<typeof createTestApi>[1]["role"]) => {
	const t = await createTestApi(PasswordResetApi, { role });
	cleanup = t.cleanup;
	const target = await t.db.user.create({
		data: {
			name: "Vergesslich",
			password: await hashPassword("old"),
			passwordReset: { create: {} },
			userName: "vergesslich",
		},
		include: { passwordReset: true },
	});
	// biome-ignore lint/style/noNonNullAssertion: created just above
	return { ...t, reset: target.passwordReset!, target };
};

describe("PasswordResetApi policy", () => {
	it("matches the reviewed access table", () => {
		expect(PasswordResetApi.policy).toMatchInlineSnapshot(`
			{
			  "complete": "PUBLIC",
			  "create": "ADMIN",
			  "get": "PUBLIC",
			}
		`);
	});

	it("denies a non-admin creating a reset", async () => {
		const { api, db, target } = await setup("USER");
		await expect(api.create(target.id)).rejects.toBeInstanceOf(ForbiddenError);
		expect(await db.passwordReset.count()).toBe(1);
	});
});

describe("PasswordResetApi.get", () => {
	it("returns only what the reset page needs", async () => {
		const { api, reset } = await setup(null);
		const result = await api.get(reset.id);
		expect(result).toEqual({
			createdAt: reset.createdAt,
			id: reset.id,
			user: { userName: "vergesslich" },
		});
		expectNoCredentials(result);
	});

	it("throws NotFoundError for an unknown token", async () => {
		const { api } = await setup(null);
		const call = api.get("nope");
		await expect(call).rejects.toBeInstanceOf(NotFoundError);
		await expect(call).rejects.toThrow(
			m.common_password_reset_request_not_found(),
		);
	});
});

describe("PasswordResetApi.create", () => {
	it("replaces an existing reset with a fresh one", async () => {
		const { api, db, reset, target } = await setup("ADMIN");
		const created = await api.create(target.id);
		expect(created.id).not.toBe(reset.id);
		expect(await db.passwordReset.findMany()).toEqual([created]);
	});

	it("throws NotFoundError for an unknown user", async () => {
		const { api } = await setup("ADMIN");
		await expect(api.create("nope")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("PasswordResetApi.complete", () => {
	it("sets the password, consumes the token and signs the user in", async () => {
		const { api, db, reset, session, target } = await setup(null);
		const result = await api.complete(reset.id, "new", "new");
		expectNoCredentials(result);
		expect(result).toEqual({
			id: target.id,
			name: "Vergesslich",
			role: "USER",
			userName: "vergesslich",
		});
		expect(session.stored).toEqual(result);
		expect(await db.passwordReset.count()).toBe(0);
		const row = await db.user.findUniqueOrThrow({ where: { id: target.id } });
		expect(row.password).toBe(await hashPassword("new"));
	});

	it("rejects mismatched passwords and changes nothing", async () => {
		const { api, db, reset, target } = await setup(null);
		await expect(api.complete(reset.id, "a", "b")).rejects.toBeInstanceOf(
			ApiError,
		);
		expect(await db.passwordReset.count()).toBe(1);
		const row = await db.user.findUniqueOrThrow({ where: { id: target.id } });
		expect(row.password).toBe(await hashPassword("old"));
	});

	it("throws NotFoundError for an unknown token", async () => {
		const { api } = await setup(null);
		await expect(api.complete("nope", "a", "a")).rejects.toBeInstanceOf(
			NotFoundError,
		);
	});
});

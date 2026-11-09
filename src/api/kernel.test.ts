// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/session";
import { m } from "@/paraglide/messages";
import { createFakeSession } from "@/test/fakeSession";
import {
	ApiBase,
	type ApiContext,
	ForbiddenError,
	NotFoundError,
	ok,
	type Policies,
} from "./kernel.server";

class ProbeApi extends ApiBase {
	static readonly policy = {
		admin: "ADMIN",
		authenticated: "AUTHENTICATED",
		boom: "AUTHENTICATED",
		callsAdminInternally: "AUTHENTICATED",
		editor: "EDITOR",
		missing: "AUTHENTICATED",
		open: "PUBLIC",
		whoAmI: "AUTHENTICATED",
	} as const satisfies Policies<ProbeApi>;

	async admin() {
		return "admin";
	}
	async authenticated() {
		return "authenticated";
	}
	async editor() {
		return "editor";
	}
	async open() {
		return "open";
	}
	async boom(): Promise<never> {
		throw new Error("SQLITE_CONSTRAINT: raw driver text");
	}
	async missing(): Promise<never> {
		throw new NotFoundError("nope");
	}
	async callsAdminInternally() {
		return this.admin();
	}
	async whoAmI() {
		return this.actorId;
	}
}

const user = (role: SessionUser["role"]): SessionUser => ({
	id: `u-${role}`,
	name: role,
	role,
	userName: role.toLowerCase(),
});
const ctx = (u: SessionUser | null): ApiContext => ({
	db: {} as PrismaClient,
	session: createFakeSession(u).store,
	user: u,
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ApiBase policy enforcement", () => {
	it("lets anyone call PUBLIC methods, including anonymous callers", async () => {
		await expect(new ProbeApi(ctx(null)).open()).resolves.toBe("open");
	});

	it("rejects anonymous callers on AUTHENTICATED methods with ForbiddenError", async () => {
		const call = new ProbeApi(ctx(null)).authenticated();
		await expect(call).rejects.toBeInstanceOf(ForbiddenError);
		await expect(call).rejects.toThrow(m.common_unauthorized());
	});

	it.each([
		["USER", "editor", false],
		["EDITOR", "editor", true],
		["ADMIN", "editor", true],
		["EDITOR", "admin", false],
		["ADMIN", "admin", true],
		["USER", "authenticated", true],
	] as const)("%s calling %s allowed=%s", async (role, method, allowed) => {
		const call = new ProbeApi(ctx(user(role)))[method]();
		if (allowed) {
			await expect(call).resolves.toBe(method);
		} else {
			await expect(call).rejects.toBeInstanceOf(ForbiddenError);
		}
	});

	it("skips the policy check for internal this-calls", async () => {
		await expect(
			new ProbeApi(ctx(user("USER"))).callsAdminInternally(),
		).resolves.toBe("admin");
	});

	it("leaves non-policy members (inherited from Object) unwrapped", () => {
		const api = new ProbeApi(ctx(null));
		expect(api.toString()).toBe("[object Object]");
		expect(api.constructor).toBe(ProbeApi);
	});

	it("exposes the acting user's id as actorId, null when anonymous", async () => {
		await expect(new ProbeApi(ctx(user("USER"))).whoAmI()).resolves.toBe(
			"u-USER",
		);
		class PublicProbe extends ApiBase {
			static readonly policy = {
				whoAmI: "PUBLIC",
			} as const satisfies Policies<PublicProbe>;
			async whoAmI() {
				return this.actorId;
			}
		}
		await expect(new PublicProbe(ctx(null)).whoAmI()).resolves.toBeNull();
	});

	it("requireSelfOrRole lets the user themselves or the role through", async () => {
		class OwnRecord extends ApiBase {
			static readonly policy = {
				touch: "AUTHENTICATED",
			} as const satisfies Policies<OwnRecord>;
			async touch(userId: string) {
				this.requireSelfOrRole(userId, "ADMIN");
				return "ok";
			}
		}
		const asUser = new OwnRecord(ctx(user("USER")));
		await expect(asUser.touch("u-USER")).resolves.toBe("ok");
		await expect(asUser.touch("someone-else")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		await expect(
			new OwnRecord(ctx(user("ADMIN"))).touch("someone-else"),
		).resolves.toBe("ok");
	});

	it("refuses to construct a class without a static policy table", () => {
		class NoPolicy extends ApiBase {}
		expect(() => new NoPolicy(ctx(null))).toThrow(/static policy/);
	});
});

describe("ApiBase error translation", () => {
	it("logs unexpected errors once and rethrows a generic message", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const call = new ProbeApi(ctx(user("USER"))).boom();
		await expect(call).rejects.toThrow(m.common_something_went_wrong());
		await expect(call).rejects.not.toThrow(/SQLITE/);
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0][0]).toBe("[ProbeApi.boom]");
		expect(log.mock.calls[0][1]).toBe("u-USER");
	});

	it("passes ApiErrors through unchanged and does not log them", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const call = new ProbeApi(ctx(user("USER"))).missing();
		await expect(call).rejects.toBeInstanceOf(NotFoundError);
		await expect(call).rejects.toThrow("nope");
		expect(log).not.toHaveBeenCalled();
	});
});

describe("ok", () => {
	it("pairs data with the localized success message", () => {
		expect(ok("done", { id: "x" })).toEqual({
			data: { id: "x" },
			message: "done",
		});
	});
});

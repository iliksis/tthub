// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages";
import { expectNoCredentials } from "@/test/noCredentials";
import { buildContext } from "./kernel.server";

// A cookie issued by the old login: the whole User row, not just SessionUser.
const clear = vi.hoisted(() => vi.fn());
const legacyData = {
	feedId: "feed-1",
	id: "u1",
	name: "Ada",
	password: "legacy-hash",
	role: "USER",
	userName: "ada",
};

const findUnique = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prismaClient: { user: { findUnique } } }));
vi.mock("@/lib/session", () => ({
	useAppSession: async () => ({ clear, data: legacyData }),
}));

describe("buildContext", () => {
	it("uses the DB's current role, not the cookie's", async () => {
		findUnique.mockResolvedValue({
			id: "u1",
			name: "Ada",
			role: "ADMIN",
			userName: "ada",
		});
		const { user } = await buildContext();
		expect(user).toEqual({
			id: "u1",
			name: "Ada",
			role: "ADMIN",
			userName: "ada",
		});
		expectNoCredentials(user);
	});

	it("treats a deleted user as signed out and clears the cookie", async () => {
		findUnique.mockResolvedValue(null);
		expect((await buildContext()).user).toBeNull();
		expect(clear).toHaveBeenCalled();
	});

	it("replaces a failing lookup with the generic error", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		findUnique.mockRejectedValue(new Error("SQLITE_BUSY"));
		await expect(buildContext()).rejects.toThrow(
			m.common_something_went_wrong(),
		);
	});

	it("skips the lookup without a session id", async () => {
		findUnique.mockClear();
		legacyData.id = "";
		expect((await buildContext()).user).toBeNull();
		expect(findUnique).not.toHaveBeenCalled();
	});
});

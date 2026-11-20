// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { expectNoCredentials } from "@/test/noCredentials";
import { buildContext } from "./kernel.server";

// A cookie issued by the old login: the whole User row, not just SessionUser.
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
	useAppSession: async () => ({ data: legacyData }),
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

	it("treats a deleted user as signed out", async () => {
		findUnique.mockResolvedValue(null);
		expect((await buildContext()).user).toBeNull();
	});
});

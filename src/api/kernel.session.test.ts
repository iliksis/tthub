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

vi.mock("@/lib/session", () => ({
	useAppSession: async () => ({ data: legacyData }),
}));

describe("buildContext", () => {
	it("exposes only the SessionUser fields of a legacy session", async () => {
		const { user } = await buildContext();
		expect(user).toEqual({
			id: "u1",
			name: "Ada",
			role: "USER",
			userName: "ada",
		});
		expectNoCredentials(user);
	});
});

import { describe, expect, it } from "vitest";
import { ttrViewerBaseUrl, ttrViewerPlayerUrl } from "./ttrViewer";

describe("ttrViewer", () => {
	it("falls back to the production address when unset or blank", () => {
		expect(ttrViewerBaseUrl(undefined)).toBe("https://ttr.tmueller.dev");
		expect(ttrViewerBaseUrl("  ")).toBe("https://ttr.tmueller.dev");
	});

	it("uses the configured value without trailing slash", () => {
		expect(ttrViewerBaseUrl("https://example.test/")).toBe(
			"https://example.test",
		);
		expect(ttrViewerPlayerUrl("NU123", "https://example.test")).toBe(
			"https://example.test/player/NU123",
		);
	});
});

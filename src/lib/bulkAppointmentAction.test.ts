import { describe, expect, it, vi } from "vitest";
import { runBulkAppointmentAction } from "@/lib/bulkAppointmentAction";

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn() },
}));

describe("runBulkAppointmentAction", () => {
	it("does nothing when there is no pending selection", async () => {
		const serverFn = vi.fn();
		const resync = vi.fn();
		const onSuccess = vi.fn();

		await runBulkAppointmentAction({
			buildPayload: (base) => base,
			excludeIds: new Set(),
			onSuccess,
			pending: null,
			resync,
			search: {},
			serverFn,
		});

		expect(serverFn).not.toHaveBeenCalled();
		expect(resync).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("sends an ids selector, resyncs, and reports acted-on ids to drop", async () => {
		const serverFn = vi.fn().mockResolvedValue({ message: "done" });
		const resync = vi.fn().mockResolvedValue(undefined);
		const onSuccess = vi.fn();

		await runBulkAppointmentAction({
			buildPayload: (base) => base,
			excludeIds: new Set(),
			onSuccess,
			pending: { ids: ["a", "b"], mode: "ids" },
			resync,
			search: {},
			serverFn,
		});

		expect(serverFn).toHaveBeenCalledWith({ data: { ids: ["a", "b"] } });
		expect(resync).toHaveBeenCalled();
		const { keep } = onSuccess.mock.calls[0][0];
		expect(keep("a")).toBe(false);
		expect(keep("c")).toBe(true);
	});

	it("sends a matching selector with the exclude-list, and keep() reflects it", async () => {
		const serverFn = vi.fn().mockResolvedValue({ message: "done" });
		const resync = vi.fn().mockResolvedValue(undefined);
		const onSuccess = vi.fn();

		await runBulkAppointmentAction({
			buildPayload: (base) => base,
			excludeIds: new Set(["x"]),
			onSuccess,
			pending: { mode: "matching" },
			resync,
			search: { query: "foo" },
			serverFn,
		});

		expect(serverFn).toHaveBeenCalledWith({
			data: { excludeIds: ["x"], matching: { query: "foo" } },
		});
		const { keep } = onSuccess.mock.calls[0][0];
		expect(keep("x")).toBe(true);
		expect(keep("y")).toBe(false);
	});

	it("lets buildPayload merge in action-specific extras", async () => {
		const serverFn = vi.fn().mockResolvedValue({ message: "copied" });
		const resync = vi.fn().mockResolvedValue(undefined);

		await runBulkAppointmentAction({
			buildPayload: (base) => ({ ...base, targetSeasonId: "season-1" }),
			excludeIds: new Set(),
			onSuccess: vi.fn(),
			pending: { ids: ["a"], mode: "ids" },
			resync,
			search: {},
			serverFn,
		});

		expect(serverFn).toHaveBeenCalledWith({
			data: { ids: ["a"], targetSeasonId: "season-1" },
		});
	});

	it("resyncs and skips onSuccess when the server call fails", async () => {
		const serverFn = vi.fn().mockRejectedValue(new Error("boom"));
		const resync = vi.fn().mockResolvedValue(undefined);
		const onSuccess = vi.fn();

		await runBulkAppointmentAction({
			buildPayload: (base) => base,
			excludeIds: new Set(),
			onSuccess,
			pending: { ids: ["a"], mode: "ids" },
			resync,
			search: {},
			serverFn,
		});

		expect(onSuccess).not.toHaveBeenCalled();
		expect(resync).toHaveBeenCalled();
	});

	it("never rejects even when resync itself fails", async () => {
		const serverFn = vi.fn().mockResolvedValue({ message: "done" });
		const resync = vi.fn().mockRejectedValue(new Error("navigation aborted"));

		await expect(
			runBulkAppointmentAction({
				buildPayload: (base) => base,
				excludeIds: new Set(),
				onSuccess: vi.fn(),
				pending: { ids: ["a"], mode: "ids" },
				resync,
				search: {},
				serverFn,
			}),
		).resolves.toBeUndefined();
	});

	it("only sends the whitelisted filter fields in a matching selector, dropping extras like skip", async () => {
		const serverFn = vi.fn().mockResolvedValue({ message: "done" });
		const resync = vi.fn().mockResolvedValue(undefined);

		await runBulkAppointmentAction({
			buildPayload: (base) => base,
			excludeIds: new Set(),
			onSuccess: vi.fn(),
			pending: { mode: "matching" },
			resync,
			search: { query: "foo", skip: 40 } as never,
			serverFn,
		});

		expect(serverFn).toHaveBeenCalledWith({
			data: { excludeIds: [], matching: { query: "foo" } },
		});
	});
});

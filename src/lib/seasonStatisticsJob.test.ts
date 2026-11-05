import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	runStatisticsRefresh,
	STATISTICS_REFRESH_CRON,
	STATISTICS_REFRESH_JOB_KEY,
	STATISTICS_REFRESH_PROTECT,
	STATISTICS_REFRESH_TIMEZONE,
	startStatisticsRefreshJob,
} from "./seasonStatisticsJob";

describe("schedule constants", () => {
	it("run daily at 03:00 Europe/Berlin with the overrun guard on", () => {
		expect(STATISTICS_REFRESH_CRON).toBe("0 3 * * *");
		expect(STATISTICS_REFRESH_TIMEZONE).toBe("Europe/Berlin");
		expect(STATISTICS_REFRESH_PROTECT).toBe(true);
	});
});

describe("runStatisticsRefresh", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("calls the recompute once on success and logs the refreshed Season", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const recompute = vi.fn().mockResolvedValue({ seasonId: "s" });
		await runStatisticsRefresh(recompute);
		expect(recompute).toHaveBeenCalledOnce();
		expect(info).toHaveBeenCalledOnce();
		expect(info.mock.calls[0][0]).toContain("refreshed Season s");
	});

	it("logs a skipped night without an Active Season", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		await runStatisticsRefresh(vi.fn().mockResolvedValue(null));
		expect(info.mock.calls[0][0]).toContain("no Active Season");
	});

	it("logs a failing recompute with console.error and does not throw", async () => {
		const error = new Error("db locked");
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const recompute = vi.fn().mockRejectedValue(error);
		await expect(runStatisticsRefresh(recompute)).resolves.toBeUndefined();
		expect(consoleError).toHaveBeenCalledOnce();
		expect(consoleError.mock.calls[0]).toContain(error);
	});
});

describe("startStatisticsRefreshJob", () => {
	const store = globalThis as Record<string, unknown>;
	beforeEach(() => {
		delete store[STATISTICS_REFRESH_JOB_KEY];
		vi.spyOn(console, "info").mockImplementation(() => {});
	});
	afterEach(() => {
		delete store[STATISTICS_REFRESH_JOB_KEY];
		vi.restoreAllMocks();
	});

	it("does not schedule outside production", () => {
		const schedule = vi.fn();
		for (const env of ["development", "test", undefined]) {
			startStatisticsRefreshJob({ env, recompute: vi.fn(), schedule });
		}
		expect(schedule).not.toHaveBeenCalled();
	});

	it("schedules in production with the agreed settings", () => {
		const schedule = vi.fn();
		startStatisticsRefreshJob({
			env: "production",
			recompute: vi.fn(),
			schedule,
		});
		expect(schedule).toHaveBeenCalledOnce();
		expect(schedule.mock.calls[0].slice(0, 2)).toEqual([
			"0 3 * * *",
			{ protect: true, timezone: "Europe/Berlin" },
		]);
	});

	it("starts only once, even when called again", () => {
		const schedule = vi.fn();
		const options = { env: "production", recompute: vi.fn(), schedule };
		startStatisticsRefreshJob(options);
		startStatisticsRefreshJob(options);
		expect(schedule).toHaveBeenCalledOnce();
	});

	it("logs once that the job was scheduled", () => {
		const info = vi.mocked(console.info);
		startStatisticsRefreshJob({
			env: "production",
			recompute: vi.fn(),
			schedule: vi.fn(),
		});
		expect(info).toHaveBeenCalledOnce();
		expect(info.mock.calls[0][0]).toContain("scheduled");
	});

	it("runs the recompute when the schedule fires, without a startup run", async () => {
		const recompute = vi.fn().mockResolvedValue({ seasonId: "s" });
		const schedule = vi.fn();
		startStatisticsRefreshJob({ env: "production", recompute, schedule });
		expect(recompute).not.toHaveBeenCalled();
		await schedule.mock.calls[0][2]();
		expect(recompute).toHaveBeenCalledOnce();
	});
});

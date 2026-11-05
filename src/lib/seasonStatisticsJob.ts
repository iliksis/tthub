import { Cron } from "croner";

// Daily at 03:00 local time of STATISTICS_REFRESH_TIMEZONE.
export const STATISTICS_REFRESH_CRON = "0 3 * * *";
export const STATISTICS_REFRESH_TIMEZONE = "Europe/Berlin";
// Skip a run while the previous one is still going.
export const STATISTICS_REFRESH_PROTECT = true;
// Global key so a dev-server reload (which re-evaluates modules) cannot start
// a second scheduler.
export const STATISTICS_REFRESH_JOB_KEY = "__tthubStatisticsRefreshJob";

type Schedule = (
	pattern: string,
	options: { timezone: string; protect: boolean },
	run: () => Promise<void>,
) => unknown;

const defaultSchedule: Schedule = (pattern, options, run) =>
	new Cron(pattern, options, run);

// The job body. Never throws: a failed night is logged and skipped, leaving
// the previous record untouched (the recompute is a single upsert).
export async function runStatisticsRefresh(
	recompute: () => Promise<{ seasonId: string } | null>,
): Promise<void> {
	try {
		const record = await recompute();
		// One line per run, so a night is visible in the logs even on success.
		console.info(
			record
				? `Nightly Season Statistics refresh: refreshed Season ${record.seasonId}`
				: "Nightly Season Statistics refresh: skipped, no Active Season",
		);
	} catch (e) {
		console.error("Nightly Season Statistics refresh failed", e);
	}
}

// Starts the nightly refresh of the Active Season's record. Production only,
// and at most once per process. No startup run and no last-run bookkeeping: a
// deploy leaves the record as it was until 03:00 or a manual refresh.
export function startStatisticsRefreshJob({
	env = process.env.NODE_ENV,
	recompute,
	schedule = defaultSchedule,
}: {
	env?: string;
	recompute: () => Promise<{ seasonId: string } | null>;
	schedule?: Schedule;
}) {
	if (env !== "production") return;
	const store = globalThis as Record<string, unknown>;
	if (STATISTICS_REFRESH_JOB_KEY in store) return;
	console.info(
		`Season Statistics refresh scheduled: "${STATISTICS_REFRESH_CRON}" (${STATISTICS_REFRESH_TIMEZONE})`,
	);
	store[STATISTICS_REFRESH_JOB_KEY] = schedule(
		STATISTICS_REFRESH_CRON,
		{
			protect: STATISTICS_REFRESH_PROTECT,
			timezone: STATISTICS_REFRESH_TIMEZONE,
		},
		() => runStatisticsRefresh(recompute),
	);
}

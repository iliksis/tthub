import handler from "@tanstack/react-start/server-entry";
import { prismaClient } from "@/lib/db";
import { recomputeActiveSeasonStatistics } from "@/lib/seasonStatistics";
import { startStatisticsRefreshJob } from "@/lib/seasonStatisticsJob";
import { paraglideMiddleware } from "@/paraglide/server.js";

// One transaction, like the manual refresh, so activating another Season
// mid-run can't overwrite the old Season's record.
startStatisticsRefreshJob({
	recompute: () =>
		prismaClient.$transaction((tx) => recomputeActiveSeasonStatistics(tx)),
});

export default {
	fetch(req: Request): Promise<Response> {
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};

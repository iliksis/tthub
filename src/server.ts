import handler from "@tanstack/react-start/server-entry";
import { startStatisticsRefreshJob } from "@/lib/seasonStatisticsJob";
import { recomputeActiveSeasonStatisticsNightly } from "@/lib/seasonStatisticsNightly";
import { paraglideMiddleware } from "@/paraglide/server.js";

startStatisticsRefreshJob({
	recompute: recomputeActiveSeasonStatisticsNightly,
});

export default {
	fetch(req: Request): Promise<Response> {
		return paraglideMiddleware(req, () => handler.fetch(req));
	},
};

import { prismaClient } from "@/lib/db";
import { recomputeActiveSeasonStatisticsInTransaction } from "@/lib/seasonStatistics";

// The nightly job's recompute, wired to the app's Prisma client. Kept out of
// src/api/*: a plain export there that uses prismaClient would pull Prisma
// into the client bundle. A missing Active Season is a no-op (null).
export const recomputeActiveSeasonStatisticsNightly = () =>
	recomputeActiveSeasonStatisticsInTransaction(prismaClient);

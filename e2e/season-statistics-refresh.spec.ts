import { expect, test } from "@playwright/test";
import { prismaClient } from "../src/lib/db";
import { recomputeActiveSeasonStatistics } from "../src/lib/seasonStatistics";
import { loginAs } from "./helpers";

const PREFIX = "E2EREFRESH-";
const BUTTON = "Statistiken aktualisieren";

// Fixture Players change the Active Season's stored counts when refreshed, so
// after removing them the record is recomputed to keep other specs' figures
// (the seeded 1 / 0 / 0 / 2) intact.
async function cleanup() {
	await prismaClient.player.deleteMany({
		where: { name: { startsWith: PREFIX } },
	});
	await recomputeActiveSeasonStatistics(prismaClient);
}

test.beforeAll(cleanup);
test.afterAll(async () => {
	await cleanup();
	await prismaClient.$disconnect();
});

test.describe("Seasons settings - manual statistics refresh", () => {
	test("EDITOR refreshes the Active Season and the stats page reflects it", async ({
		page,
	}) => {
		const active = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		const baseline = await recomputeActiveSeasonStatistics(prismaClient);
		if (!baseline) throw new Error("no Active Season record");

		// Changing a Player's Spielberechtigt does not touch the stored record on
		// its own; only the refresh does.
		const player = await prismaClient.player.create({
			data: {
				isEligibleToPlay: false,
				name: `${PREFIX}Player`,
				qttr: 1000,
				year: 1990,
			},
		});
		await prismaClient.player.update({
			data: { isEligibleToPlay: true },
			where: { id: player.id },
		});
		const stale = await prismaClient.seasonStatistics.findUniqueOrThrow({
			where: { seasonId: active.id },
		});
		expect(stale.eligibleCount).toBe(baseline.eligibleCount);

		await loginAs(page, "editor");
		await page.goto("/settings/seasons");
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: BUTTON }).click();
		await expect(page.getByText("Statistiken aktualisiert")).toBeVisible();

		const fresh = await prismaClient.seasonStatistics.findUniqueOrThrow({
			where: { seasonId: active.id },
		});
		expect(fresh.eligibleCount).toBe(baseline.eligibleCount + 1);
		expect(fresh.computedAt.getTime()).toBeGreaterThan(
			stale.computedAt.getTime(),
		);

		await page.goto("/stats");
		await page.waitForLoadState("networkidle");
		const chart = page.getByRole("img", {
			name: "Spielerzahl im Saisonvergleich",
		});
		await chart.scrollIntoViewIfNeeded();
		const label = await chart
			.getByText(active.name, { exact: true })
			.boundingBox();
		const plot = await chart.boundingBox();
		if (!label || !plot) throw new Error("chart not laid out");
		await page.mouse.move(label.x + label.width / 2, plot.y + plot.height / 2);
		const tooltip = page.getByRole("status").filter({ hasText: active.name });
		await expect(
			tooltip.locator(".ts-chart-tooltip__row", {
				hasText: "Spielberechtigt gesamt",
			}),
		).toHaveText(`Spielberechtigt gesamt${fresh.eligibleCount}`);
	});

	test("ADMIN can refresh too", async ({ page }) => {
		await loginAs(page, "admin");
		await page.goto("/settings/seasons");
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: BUTTON }).click();
		await expect(page.getByText("Statistiken aktualisiert")).toBeVisible();
	});

	test("only the Active Season's entry has the button", async ({ page }) => {
		await loginAs(page, "editor");
		await page.goto("/settings/seasons");
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("button", { name: BUTTON })).toHaveCount(1);
	});

	test("no Active Season: no button", async ({ page }) => {
		const active = await prismaClient.season.findFirstOrThrow({
			where: { isActive: true },
		});
		await prismaClient.season.update({
			data: { isActive: false },
			where: { id: active.id },
		});
		try {
			await loginAs(page, "editor");
			await page.goto("/settings/seasons");
			await page.waitForLoadState("networkidle");
			await expect(page.getByRole("button", { name: BUTTON })).toHaveCount(0);
		} finally {
			await prismaClient.season.update({
				data: { isActive: true },
				where: { id: active.id },
			});
		}
	});
});

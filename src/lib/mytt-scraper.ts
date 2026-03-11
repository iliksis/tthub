import { chromium, type Locator } from "@playwright/test";
import { createServerFn } from "@tanstack/react-start";

export type PlayerData = {
	name: string;
	rating: string;
};

export const scrapeMytt = createServerFn().handler(async () => {
	const scrapeData = async (rows: Locator[]) => {
		const playerData: PlayerData[] = [];
		for (const [index, row] of rows.entries()) {
			//skip headers
			if (index === 0) {
				continue;
			}

			const name = await row
				.locator("td:nth-child(3) div span:nth-child(2)")
				.textContent();
			const rating = await row.locator("td:nth-child(5)").textContent();

			if (name && rating) {
				playerData.push({ name: name || "", rating: rating || "" });
			}
		}
		return playerData;
	};

	const baseUrl = `https://www.mytischtennis.de/rankings/andro-rangliste?clubnr=${process.env.MYTT_CLUBNR}&fednickname=${process.env.MYTT_FEDNICKNAME}`;
	let pageNumber = 1;
	const playerData: PlayerData[] = [];

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await page.goto(`${baseUrl}&page=${pageNumber}`);

	//accept cookies
	await page.waitForSelector("#cmpbox", {
		state: "attached",
		timeout: 5000,
	});
	await page
		.getByRole("button", { name: /(akzeptieren)|(accept all)/i })
		.click();

	let noData = false;

	while (!noData) {
		await page.waitForSelector("table");
		const rows = await page.getByRole("row").all();
		const data = await scrapeData(rows);
		playerData.push(...data);

		pageNumber++;
		await page.goto(`${baseUrl}&page=${pageNumber}`);

		const noDataElement = page.getByText(
			"Leider konnten keine Spieler für deine Filtereinstellungen gefunden werden.",
		);
		noData = await noDataElement.isVisible();
	}

	browser.close();

	return playerData;
});

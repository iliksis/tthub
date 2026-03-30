import { createFileRoute } from "@tanstack/react-router";
import { prismaClient } from "@/lib/db";
import { scrapeMytt } from "@/lib/mytt-scraper";

export const Route = createFileRoute("/api/ttr-import")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const authHeader = request.headers.get("Authorization");
				const expectedToken = process.env.API_AUTH_TOKEN;
				if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					const playerData = await scrapeMytt();
					for (const data of playerData) {
						const qttr = parseInt(data.rating);
						if (Number.isNaN(qttr)) {
							continue;
						}

						const player = await prismaClient.player.findFirst({
							where: { name: data.name },
						});

						if (player && player.qttr !== qttr) {
							await prismaClient.player.update({
								data: { qttr },
								where: { id: player.id },
							});
						}
					}
				} catch (e) {
					console.error(e);
					const error = e as Error;
					return new Response(error.message, { status: 400 });
				}

				return new Response("Import successful", { status: 200 });
			},
		},
	},
});

import { createFileRoute } from "@tanstack/react-router";
import { FeedApi } from "@/api/feed.server";
import { anonymousContext, NotFoundError } from "@/api/kernel.server";
import { IcalGenerator } from "@/lib/ical";

// HTTP and iCal formatting only; lookup and filtering live in FeedApi. The
// context is anonymous on purpose: calendar clients send no session cookie,
// and reading the session would set one on the response.
export const Route = createFileRoute("/feed/$feedId")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				let appointments: Awaited<ReturnType<FeedApi["forFeed"]>>;
				try {
					appointments = await new FeedApi(anonymousContext()).forFeed(
						params.feedId,
					);
				} catch (error) {
					// FeedApi already logged anything unexpected.
					return error instanceof NotFoundError
						? new Response("Feed not found", { status: 404 })
						: new Response("Internal server error", { status: 500 });
				}

				const icalGenerator = new IcalGenerator(new URL(request.url).origin);
				return new Response(icalGenerator.createIcalString(...appointments), {
					headers: {
						"Content-Disposition": 'attachment; filename="tthub-feed.ics"',
						"Content-Type": "text/calendar; charset=utf-8",
					},
					status: 200,
				});
			},
		},
	},
});

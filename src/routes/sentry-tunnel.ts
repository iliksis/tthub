import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/sentry-tunnel")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const SENTRY_HOST = import.meta.env.VITE_SENTRY_HOST;

				try {
					const envelopeBytes = await request.arrayBuffer();
					const envelope = new TextDecoder().decode(envelopeBytes);
					const piece = envelope.split("\n")[0];
					const header = JSON.parse(piece);
					const dsn = new URL(header.dsn);
					const project_id = dsn.pathname?.replace("/", "");
					if (dsn.hostname !== SENTRY_HOST) {
						throw new Error(`Invalid sentry hostname: ${dsn.hostname}`);
					}
					const upstream_sentry_url = `https://${SENTRY_HOST}/api/${project_id}/envelope/`;
					await fetch(upstream_sentry_url, {
						method: "POST",
						body: envelopeBytes,
					});
					return json({}, { status: 200 });
				} catch (e) {
					console.error("error tunneling to sentry", e);
					return json({ error: "error tunneling to sentry" }, { status: 500 });
				}
			},
		},
	},
});

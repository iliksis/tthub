import * as Sentry from "@sentry/tanstackstart-react";
import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
	const router = createRouter({
		defaultPreloadStaleTime: 0,
		routeTree,
		scrollRestoration: true,
	});

	if (!router.isServer) {
		Sentry.init({
			debug: import.meta.env.DEV,
			dsn: import.meta.env.VITE_SENTRY_DSN,
			environment: import.meta.env.MODE,
			integrations: [],
			tunnel: "/sentry-tunnel",
		});
	}

	return router;
};

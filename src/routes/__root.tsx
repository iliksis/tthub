import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRoute,
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import React from "react";
import { Toaster } from "sonner";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import { getTheme } from "@/components/ThemeSwitch";
import { useAppSession } from "@/lib/session";
import appCss from "../styles.css?url";

const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
	const session = await useAppSession();
	if (!session.data.userName) {
		return null;
	}
	return {
		id: session.data.id,
		name: session.data.name,
		role: session.data.role,
		userName: session.data.userName,
	};
});

export const Route = createRootRoute({
	beforeLoad: async () => {
		const user = await fetchUser();
		const theme = await getTheme();
		return { theme, user };
	},
	head: () => ({
		links: [
			{
				href: appCss,
				rel: "stylesheet",
			},
			{
				href: "/favicon-96x96.png",
				rel: "icon",
				sizes: "96x96",
				type: "image/png",
			},
			{
				href: "/favicon.svg",
				rel: "icon",
				type: "image/svg+xml",
			},
			{
				href: "/favicon.ico",
				rel: "shortcut icon",
			},
			{
				href: "/apple-touch-icon.png",
				rel: "apple-touch-icon",
				sizes: "180x180",
			},
			{
				content: "TT Hub",
				rel: "apple-mobile-web-app-title",
			},
			{
				href: "/manifest.json",
				rel: "manifest",
			},
		],
		meta: [
			{
				charSet: "utf-8",
			},
			{
				content: "width=device-width, initial-scale=1",
				name: "viewport",
			},
		],
	}),
	shellComponent: RootDocument,
});

const queryClient = new QueryClient();

function RootDocument({ children }: { children: React.ReactNode }) {
	const { user, theme } = Route.useRouteContext();
	const routerState = useRouterState({
		select: (state) => {
			const path = state.location.pathname;
			return (
				state.matches
					.filter((match) => match.pathname.startsWith(path))
					// biome-ignore lint/style/noNonNullAssertion: is always defined
					.map((match) => match.meta!)
					.filter(Boolean)
			);
		},
	});
	const title = routerState.at(-1)?.[0]?.title;

	const isAuthedRoute = useRouterState({
		select: (state) => state.matches.some((m) => m.routeId === "/_authed"),
	});

	React.useEffect(() => {
		const registerServiceWorker = async () => {
			if ("serviceWorker" in navigator) {
				try {
					const registration = await navigator.serviceWorker.register(
						"/sw.js",
						{
							scope: "/",
						},
					);
					if (registration.installing) {
						console.log("Service worker installing");
					} else if (registration.waiting) {
						console.log("Service worker installed");
					} else if (registration.active) {
						console.log("Service worker active");
					}
				} catch (error) {
					console.error(`Registration failed with ${error}`);
				}
			}
		};
		registerServiceWorker();
	}, []);

	return (
		<html
			lang="en"
			data-theme={theme === "dark" ? "macchiato" : "latte"}
			className={theme}
		>
			<head>
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					{user && isAuthedRoute ? (
						<>
							<NavigationWrapper title={title}>{children}</NavigationWrapper>
							<TanStackDevtools
								config={{
									position: "bottom-left",
								}}
								plugins={[
									{
										name: "Tanstack Router",
										render: <TanStackRouterDevtoolsPanel />,
									},
								]}
							/>
						</>
					) : (
						children
					)}
				</QueryClientProvider>
				<Toaster position="top-center" />
				<Scripts />
			</body>
		</html>
	);
}

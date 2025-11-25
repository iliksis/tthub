import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { ToastContainer } from "react-toastify";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import { useAppSession } from "@/lib/session";
import appCss from "../styles.css?url";

const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
	const session = await useAppSession();
	if (!session.data.userName) {
		return null;
	}
	return {
		id: session.data.id,
		role: session.data.role,
		name: session.data.userName,
	};
});

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Dashboard",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	beforeLoad: async () => {
		const user = await fetchUser();

		return { user };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { user } = Route.useRouteContext();
	const routerState = useRouterState({
		select: (state) => {
			const path = state.location.pathname;
			return (
				state.matches
					.filter((match) => match.pathname === path)
					// biome-ignore lint/style/noNonNullAssertion: is always defined
					.map((match) => match.meta!)
					.filter(Boolean)
			);
		},
	});
	const title = routerState.at(-1)?.[0]?.title ?? "Dashboard";

	const isAuthedRoute = useRouterState({
		select: (state) => state.matches.some((m) => m.routeId === "/_authed"),
	});

	return (
		<html lang="en" data-theme="macchiato">
			<head>
				<HeadContent />
			</head>
			<body>
				{user && isAuthedRoute ? (
					<>
						<NavigationWrapper title={title}>{children}</NavigationWrapper>
						<TanStackDevtools
							config={{
								position: "bottom-right",
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
				<ToastContainer stacked />
				<Scripts />
			</body>
		</html>
	);
}

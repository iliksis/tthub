import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import {
	getThemeServerFn,
	ThemeProvider,
} from "@/components/Theme/ThemeProvider";
import appCss from "../styles.css?url";

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
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	loader: async () => {
		const theme = await getThemeServerFn();
		return { theme };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { theme } = Route.useLoaderData();
	console.log(theme);
	return (
		<html lang="en" data-theme="frappe">
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider defaultTheme={theme}>
					<NavigationWrapper title="Dashboard">{children}</NavigationWrapper>
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
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}

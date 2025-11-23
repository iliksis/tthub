import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings")({
	// head: () => ({
	// 	meta: [{ title: "Settings" }],
	// }),
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/settings"!</div>;
}

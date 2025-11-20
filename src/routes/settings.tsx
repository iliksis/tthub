import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<title>Settings</title>
			<div>Hello "/settings"!</div>
		</>
	);
}

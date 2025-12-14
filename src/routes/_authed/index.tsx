import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/")({
	component: App,
	head: () => ({
		meta: [{ title: "Dashboard" }],
	}),
});

function App() {
	return (
		<div>
			<h1>Hello World</h1>
		</div>
	);
}

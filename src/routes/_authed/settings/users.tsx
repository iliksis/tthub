import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { fetchUsers } from "@/api/users";
import { UserManagement } from "@/components/UserManagement";
import { useIsRole } from "@/lib/session";

const isUserAuthorized = createServerFn({ method: "GET" }).handler(async () => {
	return await useIsRole("ADMIN");
});

export const Route = createFileRoute("/_authed/settings/users")({
	component: RouteComponent,
	beforeLoad: async () => {
		const isAuthorized = await isUserAuthorized();
		if (!isAuthorized) {
			throw new Error("Unauthorized");
		}
	},
	errorComponent: () => <div>Error</div>,
	loader: async () => {
		const users = await fetchUsers();
		return { users };
	},
});

function RouteComponent() {
	const { users } = Route.useLoaderData();

	return (
		<div>
			<UserManagement users={users} />
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { fetchUsers } from "@/api/users";
import { UserManagement } from "@/components/UserManagement";
import { useIsRole } from "@/lib/session";
import { t } from "@/lib/text";

const isUserAuthorized = createServerFn({ method: "GET" }).handler(async () => {
	return await useIsRole("ADMIN");
});

export const Route = createFileRoute("/_authed/settings/users")({
	component: RouteComponent,
	beforeLoad: async () => {
		const isAuthorized = await isUserAuthorized();
		if (!isAuthorized) {
			throw new Error(t("Unauthorized"));
		}
	},
	errorComponent: () => <div>Error</div>,
	loader: async () => {
		const users = await fetchUsers();
		return { users };
	},
	head: () => ({
		meta: [
			{
				title: t("User Management"),
			},
		],
	}),
});

function RouteComponent() {
	const { users } = Route.useLoaderData();

	return (
		<div>
			<UserManagement users={users} />
		</div>
	);
}

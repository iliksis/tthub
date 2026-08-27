import { createFileRoute } from "@tanstack/react-router";
import { fetchUsers } from "@/api/users";
import { UserManagement } from "@/components/settings/UserManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_authed/settings/users")({
	beforeLoad: async ({ context }) => {
		if (!context.user || context.user.role !== "ADMIN") {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => (
		<Alert variant="destructive">
			<AlertDescription>
				{m.users_you_do_not_have_permission_to_access_user_management()}
			</AlertDescription>
		</Alert>
	),
	head: () => ({
		meta: [{ title: m.common_user_management() }],
	}),
	loader: async () => {
		const users = await fetchUsers();
		return { users };
	},
});

function RouteComponent() {
	const { users } = Route.useLoaderData();

	return <UserManagement users={users} />;
}

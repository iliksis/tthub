import { createFileRoute } from "@tanstack/react-router";
import { fetchUsers } from "@/api/users";
import { UserManagement } from "@/components/settings/UserManagement";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/settings/users")({
	beforeLoad: async ({ context }) => {
		if (!context.user || context.user.role !== "ADMIN") {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => (
		<div className="alert alert-error">
			{t("You do not have permission to access user management")}
		</div>
	),
	head: () => ({
		meta: [{ title: t("User Management") }],
	}),
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

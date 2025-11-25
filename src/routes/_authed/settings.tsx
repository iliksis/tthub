import { createFileRoute } from "@tanstack/react-router";
import { fetchUsers } from "@/api/users";
import { UserManagement } from "@/components/UserManagement";

export const Route = createFileRoute("/_authed/settings")({
	head: () => ({
		meta: [{ title: "Settings" }],
	}),
	component: RouteComponent,
	loader: async () => {
		const users = await fetchUsers();
		return { users };
	},
});

function RouteComponent() {
	const { user } = Route.useRouteContext();
	const { users } = Route.useLoaderData();
	return (
		<div className="tabs tabs-border">
			<input
				type="radio"
				name="my_tabs_3"
				className="tab"
				aria-label="Tab 1"
				defaultChecked={true}
			/>
			<div className="tab-content bg-base-100 border-base-300 p-6">
				Tab content 1
			</div>

			<input type="radio" name="my_tabs_3" className="tab" aria-label="Tab 2" />
			<div className="tab-content border-base-300 p-6">Tab content 2</div>

			{user?.role === "ADMIN" && (
				<>
					<input
						type="radio"
						name="my_tabs_3"
						className="tab"
						aria-label="User Management"
					/>
					<div className="tab-content bg-base-100 border-base-300 p-3">
						<UserManagement users={users} />
					</div>
				</>
			)}
		</div>
	);
}

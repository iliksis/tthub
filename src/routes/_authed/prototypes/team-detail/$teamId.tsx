import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { getTeam } from "@/api/teams";
import { ProtoPicker } from "@/prototypes/ProtoPicker";
import { CompactVariant } from "@/prototypes/team-detail/CompactVariant";
import { HeaderVariant } from "@/prototypes/team-detail/HeaderVariant";
import { SidebarVariant } from "@/prototypes/team-detail/SidebarVariant";

export const Route = createFileRoute("/_authed/prototypes/team-detail/$teamId")(
	{
		component: RouteComponent,
		loader: async ({ params }) => {
			const data = await getTeam({ data: { id: params.teamId } });
			const res = await data.json();
			if (data.status < 400) {
				return { team: res.data };
			}
			throw new Error(res.message);
		},
	},
);

const VARIANT_NAMES = ["Sidebar", "Dashboard", "Compact"];

function RouteComponent() {
	const { team } = Route.useLoaderData();
	const { user } = useRouteContext({ from: "__root__" });
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	const [active, setActive] = React.useState(() => {
		if (typeof window === "undefined") return 0;
		const v = new URLSearchParams(window.location.search).get("v");
		const parsed = (Number.parseInt(v ?? "1", 10) || 1) - 1;
		return Math.min(Math.max(parsed, 0), VARIANT_NAMES.length - 1);
	});

	const onChange = (i: number) => {
		setActive(i);
		const url = new URL(window.location.href);
		url.searchParams.set("v", String(i + 1));
		window.history.replaceState(null, "", url);
	};

	if (!team) return <div>An error occurred</div>;

	const stubProps = {
		canEdit,
		onDelete: () => toast.info("Prototype only — delete is disabled here"),
		onEdit: () => toast.info("Prototype only — edit is disabled here"),
		onPlayerClick: () =>
			toast.info("Prototype only — navigation is disabled here"),
		team,
	};

	return (
		<div className="p-4 lg:p-6">
			<div key={active}>
				{active === 0 && <SidebarVariant {...stubProps} />}
				{active === 1 && <HeaderVariant {...stubProps} />}
				{active === 2 && <CompactVariant {...stubProps} />}
			</div>
			<ProtoPicker names={VARIANT_NAMES} active={active} onChange={onChange} />
		</div>
	);
}

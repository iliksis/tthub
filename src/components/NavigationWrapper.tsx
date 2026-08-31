import { Link, useRouteContext } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	CalendarPlusIcon,
	CalendarsIcon,
	HistoryIcon,
	HouseIcon,
	ListChecksIcon,
	LogOutIcon,
	Settings2Icon,
	ShieldIcon,
	Trash2Icon,
	UsersIcon,
} from "lucide-react";
import React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import type { User } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";
import { ThemeSwitch } from "./ThemeSwitch";

type NavigationItem =
	| {
			name: string;
			href: string;
			search?: Record<string, unknown>;
			icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
			isHidden?: (role: User["role"]) => boolean;
			// Highlight active for any path under `href`, not just an exact match —
			// used for entry points (like Settings) that own their own sub-navigation.
			activeExact?: boolean;
	  }
	| {
			name: string;
			icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
			children?: NavigationItem[];
	  };

const navigationItems: NavigationItem[] = [
	{ href: "/", icon: HouseIcon, name: m.common_dashboard() },
	{
		children: [
			{
				href: "/appts",
				icon: CalendarDaysIcon,
				name: m.common_overview(),
			},
			{
				href: "/create",
				icon: CalendarPlusIcon,
				isHidden: (role) => role === "USER",
				name: m.common_create(),
			},
			{
				href: "/appts/journal",
				icon: HistoryIcon,
				isHidden: (role) => role === "USER",
				name: m.common_journal(),
			},
			{
				href: "/appts/bulk",
				icon: ListChecksIcon,
				isHidden: (role) => role === "USER",
				name: m.appointments_bulk_management(),
			},
			{
				href: "/appts/trash",
				icon: Trash2Icon,
				isHidden: (role) => role === "USER",
				name: m.appointments_trash(),
			},
		],
		icon: CalendarsIcon,
		name: m.common_appointments(),
	},
	{ href: "/players", icon: UsersIcon, name: m.common_players() },
	{ href: "/teams", icon: ShieldIcon, name: m.common_teams() },
	{
		activeExact: false,
		href: "/settings",
		icon: Settings2Icon,
		name: m.common_settings(),
	},
];

const activeLinkClassName =
	"bg-sidebar-accent text-sidebar-accent-foreground font-medium";

const NavigationItems = () => {
	const { user } = useRouteContext({ from: "__root__" });
	const { isMobile, state, setOpenMobile } = useSidebar();
	const isExpanded = isMobile || state === "expanded";

	const closeSidebar = React.useCallback(() => {
		setOpenMobile(false);
	}, [setOpenMobile]);

	const renderLeaf = (item: NavigationItem, asSubItem: boolean) => {
		if (!("href" in item) || !user || item.isHidden?.(user.role ?? "USER")) {
			return null;
		}

		const link = (
			<Link
				to={item.href}
				search={item.search}
				onClick={closeSidebar}
				activeProps={{ className: activeLinkClassName }}
				activeOptions={{
					exact: item.activeExact ?? true,
					includeSearch: !!item.search,
				}}
			>
				<item.icon />
				<span>{item.name}</span>
			</Link>
		);

		if (asSubItem) {
			return (
				<SidebarMenuSubItem key={item.name}>
					<SidebarMenuSubButton render={link} />
				</SidebarMenuSubItem>
			);
		}

		return (
			<SidebarMenuItem key={item.name}>
				<SidebarMenuButton render={link} tooltip={item.name} />
			</SidebarMenuItem>
		);
	};

	const renderItem = (item: NavigationItem) => {
		if ("children" in item) {
			// Collapsed to icons: flatten the group's children into top-level
			// icon buttons, since nested sub-menus aren't reachable when collapsed.
			if (!isExpanded) {
				return item.children?.map((child) => renderLeaf(child, false));
			}

			return (
				<SidebarMenuItem key={item.name}>
					<div className="flex items-center gap-2 rounded-md p-2 text-sm font-medium text-sidebar-foreground/70">
						<item.icon className="size-4" />
						<span>{item.name}</span>
					</div>
					<SidebarMenuSub>
						{item.children?.map((child) => renderLeaf(child, true))}
					</SidebarMenuSub>
				</SidebarMenuItem>
			);
		}

		return renderLeaf(item, false);
	};

	return <SidebarMenu>{navigationItems.map(renderItem)}</SidebarMenu>;
};

interface NavigationWrapperProps {
	title?: string;
}

export const NavigationWrapper = ({
	children,
	title,
}: React.PropsWithChildren<NavigationWrapperProps>) => {
	return (
		<SidebarProvider defaultOpen={true}>
			<Sidebar>
				<SidebarContent>
					<SidebarGroup>
						<NavigationItems />
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu>
						<ThemeSwitch />
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip={m.common_logout()}
								render={
									<Link to="/logout">
										<LogOutIcon />
										<span>{m.common_logout()}</span>
									</Link>
								}
							/>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<SidebarInset>
				<nav className="flex h-11 w-full items-center gap-2 px-3 lg:hidden">
					<SidebarTrigger className="lg:hidden" />
					<span className="font-bold text-lg">{title}</span>
				</nav>
				{/* Page content here */}
				<div className="lg:mx-4 mx-0 p-4 relative">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

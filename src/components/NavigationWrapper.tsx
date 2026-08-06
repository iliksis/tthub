import { Link, useRouteContext } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	CalendarPlusIcon,
	CalendarsIcon,
	HistoryIcon,
	HouseIcon,
	LogOutIcon,
	Settings2Icon,
	ShieldIcon,
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
import { t } from "@/lib/text";
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
	{ href: "/", icon: HouseIcon, name: t("Dashboard") },
	{
		children: [
			{
				href: "/appts",
				icon: CalendarDaysIcon,
				name: t("Overview"),
			},
			{
				href: "/create",
				icon: CalendarPlusIcon,
				isHidden: (role) => role === "USER",
				name: t("Create"),
			},
			{
				href: "/appts/journal",
				icon: HistoryIcon,
				name: t("Journal"),
			},
		],
		icon: CalendarsIcon,
		name: t("Appointments"),
	},
	{ href: "/players", icon: UsersIcon, name: t("Players") },
	{ href: "/teams", icon: ShieldIcon, name: t("Teams") },
	{
		activeExact: false,
		href: "/settings",
		icon: Settings2Icon,
		name: t("Settings"),
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
					<SidebarMenuSubButton asChild>{link}</SidebarMenuSubButton>
				</SidebarMenuSubItem>
			);
		}

		return (
			<SidebarMenuItem key={item.name}>
				<SidebarMenuButton asChild tooltip={item.name}>
					{link}
				</SidebarMenuButton>
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
							<SidebarMenuButton asChild tooltip={t("Logout")}>
								<Link to="/logout">
									<LogOutIcon />
									<span>{t("Logout")}</span>
								</Link>
							</SidebarMenuButton>
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

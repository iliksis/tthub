import { Link, useRouteContext } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	CalendarPlusIcon,
	CalendarsIcon,
	HistoryIcon,
	HouseIcon,
	ImportIcon,
	LogOutIcon,
	SearchIcon,
	Settings2Icon,
	ShieldIcon,
	TextAlignJustifyIcon,
	UserCogIcon,
	UserPenIcon,
	UsersIcon,
} from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
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
			icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
			isHidden?: (role: User["role"]) => boolean;
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
			{ href: "/appts", icon: TextAlignJustifyIcon, name: t("List") },
			{
				href: "/appts/calendar",
				icon: CalendarDaysIcon,
				name: t("Calendar"),
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
		children: [
			{ href: "/settings/profile", icon: UserPenIcon, name: t("Profile") },
			{
				href: "/settings/feed",
				icon: CalendarDaysIcon,
				name: t("Calendar Feed"),
			},
			{
				href: "/settings/imports",
				icon: ImportIcon,
				isHidden: (role) => role === "USER",
				name: t("Imports"),
			},
			{
				href: "/settings/users",
				icon: UserCogIcon,
				isHidden: (role) => role !== "ADMIN",
				name: t("User Management"),
			},
		],
		icon: Settings2Icon,
		name: t("Settings"),
	},
];

const activeLinkClassName =
	"bg-sidebar-accent text-sidebar-accent-foreground font-medium";

const NavigationItems = () => {
	const { user } = useRouteContext({ from: "__root__" });
	const { isMobile, state, setOpen, setOpenMobile } = useSidebar();
	const isExpanded = isMobile || state === "expanded";

	const closeSidebar = React.useCallback(() => {
		setOpen(false);
		setOpenMobile(false);
	}, [setOpen, setOpenMobile]);

	const renderLeaf = (item: NavigationItem, asSubItem: boolean) => {
		if (!("href" in item) || !user || item.isHidden?.(user.role ?? "USER")) {
			return null;
		}

		const link = (
			<Link
				to={item.href}
				onClick={closeSidebar}
				activeProps={{ className: activeLinkClassName }}
				activeOptions={{ exact: true }}
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
		<SidebarProvider defaultOpen={false}>
			<Sidebar collapsible="icon">
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
				<nav className="flex h-14 w-full items-center border-b border-border/40 px-4">
					<SidebarTrigger />
					<div className="px-4">{title}</div>
					<div className="flex-1" />
					<Button
						type="button"
						variant="ghost"
						className="mx-2 gap-2"
						onClick={() => {
							window.dispatchEvent(
								new KeyboardEvent("keydown", { key: "k", metaKey: true }),
							);
						}}
					>
						<SearchIcon className="size-4" />
						<span className="hidden sm:inline">{t("Search")}</span>
						<Kbd className="hidden sm:inline-flex">⌘K</Kbd>
					</Button>
				</nav>
				{/* Page content here */}
				<div className="lg:max-w-none mx-11 p-4 relative">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
};

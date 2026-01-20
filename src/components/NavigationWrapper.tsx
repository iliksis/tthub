import { Link, useRouteContext } from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	CalendarPlusIcon,
	CalendarsIcon,
	HouseIcon,
	ImportIcon,
	LogOutIcon,
	PanelLeftOpenIcon,
	Settings2Icon,
	ShieldIcon,
	TextAlignJustifyIcon,
	UserCogIcon,
	UserPenIcon,
	UsersIcon,
} from "lucide-react";
import React from "react";
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

interface NavigationWrapperProps {
	title?: string;
}

export const NavigationWrapper = ({
	children,
	title,
}: React.PropsWithChildren<NavigationWrapperProps>) => {
	const { user } = useRouteContext({ from: "__root__" });
	const toggleRef = React.useRef<HTMLInputElement>(null);
	const closeDrawer = React.useCallback(() => {
		if (toggleRef.current) {
			toggleRef.current.checked = false;
		}
	}, []);

	const renderLink = React.useCallback(
		(item: NavigationItem) => {
			if ("children" in item) {
				return (
					<React.Fragment key={item.name}>
						<li className="is-drawer-open:menu w-full p-0">
							<details className="is-drawer-close:hidden" open>
								<summary>
									<item.icon className="my-1.5 size-4" />
									<span className="is-drawer-close:hidden">{item.name}</span>
								</summary>
								<ul>{item.children?.map(renderLink)}</ul>
							</details>
						</li>
						<ul className="is-drawer-open:hidden">
							{item.children?.map(renderLink)}
						</ul>
					</React.Fragment>
				);
			} else if (
				"href" in item &&
				user &&
				!item.isHidden?.(user.role ?? "USER")
			) {
				return (
					<li key={item.name}>
						<Link
							className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
							data-tip={item.name}
							to={item.href}
							onClick={closeDrawer}
							activeProps={{
								className: "text-accent",
							}}
							activeOptions={{ exact: true }}
						>
							<item.icon className="my-1.5 size-4" />
							<span className="is-drawer-close:hidden">{item.name}</span>
						</Link>
					</li>
				);
			}
		},
		[closeDrawer, user],
	);

	return (
		<div className="drawer lg:drawer-open">
			<input
				ref={toggleRef}
				id="drawer-toggle"
				type="checkbox"
				className="drawer-toggle"
			/>
			<div className="drawer-content">
				{/* Navbar */}
				<nav className="navbar w-full bg-base-300">
					<label
						htmlFor="drawer-toggle"
						aria-label={t("open sidebar")}
						className="btn btn-square btn-ghost"
					>
						{/* Sidebar toggle icon */}
						<PanelLeftOpenIcon className="my-1.5 size-4" />
					</label>
					<div className="px-4">{title}</div>
				</nav>
				{/* Page content here */}
				<div className="max-w-4xl m-auto p-4 relative">{children}</div>
			</div>

			<div className="drawer-side is-drawer-close:overflow-visible">
				<label
					htmlFor="drawer-toggle"
					aria-label="close sidebar"
					className="drawer-overlay"
				></label>
				<div className="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64">
					{/* Sidebar content here */}
					<ul className="menu w-full grow">
						{navigationItems.map(renderLink)}
					</ul>
					<div className="divider mb-0"></div>
					<ul className="menu w-full mb-4">
						<ThemeSwitch />
						<li>
							<Link
								to="/logout"
								className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
								data-tip={t("Logout")}
							>
								<LogOutIcon className="my-1.5 size-4" />
								<span className="is-drawer-close:hidden">{t("Logout")}</span>
							</Link>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

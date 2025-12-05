import { Link } from "@tanstack/react-router";
import {
	CalendarPlusIcon,
	HouseIcon,
	PanelLeftOpenIcon,
	Settings2Icon,
	UserPenIcon,
	UsersIcon,
} from "lucide-react";
import React from "react";

type NavigationItem =
	| {
			name: string;
			href: string;
			icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	  }
	| {
			name: string;
			icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
			children?: NavigationItem[];
	  };

const navigationItems: NavigationItem[] = [
	{ name: "Homepage", href: "/", icon: HouseIcon },
	{ name: "Create Appointment", href: "/create", icon: CalendarPlusIcon },
	{
		name: "Settings",
		icon: Settings2Icon,
		children: [
			{ name: "Profile", href: "/settings/profile", icon: UserPenIcon },
			{ name: "User Management", href: "/settings/users", icon: UsersIcon },
		],
	},
];

interface NavigationWrapperProps {
	title: string;
}

export const NavigationWrapper = ({
	children,
	title,
}: React.PropsWithChildren<NavigationWrapperProps>) => {
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
			} else if ("href" in item) {
				return (
					<li key={item.name}>
						<Link
							className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
							data-tip={item.name}
							to={item.href}
							onClick={closeDrawer}
						>
							<item.icon className="my-1.5 size-4" />
							<span className="is-drawer-close:hidden"> {item.name}</span>
						</Link>
					</li>
				);
			}
		},
		[closeDrawer],
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
						aria-label="open sidebar"
						className="btn btn-square btn-ghost"
					>
						{/* Sidebar toggle icon */}
						<PanelLeftOpenIcon className="my-1.5 size-4" />
					</label>
					<div className="px-4">{title}</div>
				</nav>
				{/* Page content here */}
				<div className="p-4">{children}</div>
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
				</div>
			</div>
		</div>
	);
};

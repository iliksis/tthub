import { Link } from "@tanstack/react-router";
import { HouseIcon, PanelLeftOpenIcon, Settings2Icon } from "lucide-react";

interface NavigationWrapperProps {
	title: string;
}

export const NavigationWrapper = ({
	children,
	title,
}: React.PropsWithChildren<NavigationWrapperProps>) => {
	const closeDrawer = () => {
		const toggle = document.querySelector<HTMLInputElement>("#drawer-toggle");
		if (toggle) {
			toggle.checked = false;
		}
	};

	return (
		<div className="drawer lg:drawer-open">
			<input id="drawer-toggle" type="checkbox" className="drawer-toggle" />
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
					htmlFor="my-drawer-4"
					aria-label="close sidebar"
					className="drawer-overlay"
				></label>
				<div className="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64">
					{/* Sidebar content here */}
					<ul className="menu w-full grow">
						{/* List item */}
						<li>
							<Link
								className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
								data-tip="Homepage"
								to="/"
								onClick={closeDrawer}
							>
								{/* Home icon */}
								<HouseIcon className="my-1.5 size-4" />
								<span className="is-drawer-close:hidden">Homepage</span>
							</Link>
						</li>

						{/* List item */}
						<li>
							<Link
								className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
								data-tip="Settings"
								to="/settings"
								onClick={closeDrawer}
							>
								{/* Settings icon */}
								<Settings2Icon className="my-1.5 size-4" />
								<span className="is-drawer-close:hidden">Settings</span>
							</Link>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

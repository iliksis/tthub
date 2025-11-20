import { Link } from "@tanstack/react-router";
import {
	HouseIcon,
	Moon,
	PanelLeftOpenIcon,
	Settings2Icon,
	Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type AppTheme, useTheme } from "./Theme/ThemeProvider";

const themeConfig: Record<AppTheme, { icon: React.ReactNode; label: string }> =
	{
		latte: { icon: <Sun className="my-1.5 size-4" />, label: "Light" },
		frappe: { icon: <Moon className="my-1.5 size-4" />, label: "Dark" },
	};

interface NavigationWrapperProps {
	title: string;
}

export const NavigationWrapper = ({
	children,
	title,
}: React.PropsWithChildren<NavigationWrapperProps>) => {
	const { theme, setTheme } = useTheme();

	const getNextTheme = () => {
		const themes = Object.keys(themeConfig) as AppTheme[];
		const currentIndex = themes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		return themes[nextIndex];
	};

	return (
		<div className="drawer lg:drawer-open">
			<input id="my-drawer-4" type="checkbox" className="drawer-toggle" />
			<div className="drawer-content">
				{/* Navbar */}
				<nav className="navbar w-full bg-base-300">
					<label
						htmlFor="my-drawer-4"
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
							>
								{/* Settings icon */}
								<Settings2Icon className="my-1.5 size-4" />
								<span className="is-drawer-close:hidden">Settings</span>
							</Link>
						</li>
						<div className="divider"></div>
						<li>
							<button
								type="button"
								onClick={() => setTheme(getNextTheme())}
								className="is-drawer-close:tooltip is-drawer-close:tooltip-right"
								data-tip={
									theme === "latte"
										? "Switch to Dark Theme"
										: "Switch to Light Theme"
								}
							>
								<span
									className={cn(
										"flex items-center gap-2",
										theme !== "latte" && "hidden",
									)}
								>
									{themeConfig.latte.icon}
									<span className="is-drawer-close:hidden">
										{themeConfig.latte.label}
									</span>
								</span>
								<span className={cn("", theme !== "frappe" && "hidden")}>
									{themeConfig.frappe.icon}
									<span className="is-drawer-close:hidden">
										{themeConfig.frappe.label}
									</span>
								</span>
							</button>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

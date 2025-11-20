import { cn } from "@/lib/utils";
import { type AppTheme, useTheme } from "./ThemeProvider";

const themeConfig: Record<AppTheme, { icon: string; label: string }> = {
	latte: { icon: "☀️", label: "Light" },
	frappe: { icon: "🌙", label: "Dark" },
};

export const ThemeToggle = () => {
	const { theme, setTheme } = useTheme();

	const getNextTheme = () => {
		const themes = Object.keys(themeConfig) as AppTheme[];
		const currentIndex = themes.indexOf(theme);
		const nextIndex = (currentIndex + 1) % themes.length;
		return themes[nextIndex];
	};

	return (
		<button
			type="button"
			onClick={() => setTheme(getNextTheme())}
			className="swap swap-rotate"
		>
			<span className={cn("", theme !== "latte" && "hidden")}>
				<span className="is-drawer-close:hidden">
					{themeConfig.latte.label}
				</span>
				<span className="ml-1">{themeConfig.latte.icon}</span>
			</span>
			<span className={cn("", theme !== "frappe" && "hidden")}>
				<span className="is-drawer-close:hidden">
					{themeConfig.frappe.label}
				</span>
				<span className="ml-1">{themeConfig.frappe.icon}</span>
			</span>
		</button>
	);
};

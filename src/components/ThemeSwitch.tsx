import { useRouteContext, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { MoonIcon, SunIcon } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";

export const ThemeSwitch = () => {
	const { theme } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const toggleThemeServerFn = useServerFn(toggleTheme);
	const onClick = async () => {
		await toggleThemeServerFn();
		await router.invalidate();
	};

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				type="button"
				onClick={onClick}
				tooltip={m.common_switch_theme()}
			>
				{theme === "light" ? <SunIcon /> : <MoonIcon />}
				<span>{m.common_switch_theme()}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
};

const toggleTheme = createServerFn().handler(async () => {
	const theme = getCookie("theme");
	if (theme === "dark" || theme === undefined) {
		setCookie("theme", "light");
	} else {
		setCookie("theme", "dark");
	}
});

export const getTheme = createServerFn().handler(async () => {
	const theme = getCookie("theme");
	return (theme ?? "dark") as "light" | "dark";
});

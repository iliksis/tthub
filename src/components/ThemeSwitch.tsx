import { useRouteContext, useRouter } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { MoonIcon, SunIcon } from "lucide-react";
import { t } from "@/lib/text";

export const ThemeSwitch = () => {
	const { theme } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const toggleThemeServerFn = useServerFn(toggleTheme);
	const onClick = async () => {
		await toggleThemeServerFn();
		await router.invalidate();
	};

	return (
		<li
			className="is-drawer-close:btn-square is-drawer-close:tooltip is-drawer-close:tooltip-right"
			data-tip={t("Switch Theme")}
		>
			<button type="button" onClick={onClick}>
				{theme === "light" ? (
					<SunIcon className="my-1.5 size-4" />
				) : (
					<MoonIcon className="my-1.5 size-4" />
				)}
				<span className="is-drawer-close:hidden">{t("Switch Theme")}</span>
			</button>
		</li>
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

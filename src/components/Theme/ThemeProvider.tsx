import { ScriptOnce } from "@tanstack/react-router";
import { createClientOnlyFn, createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start-server";
import { createContext, useContext, useState } from "react";
import { z } from "zod";

const storageKey = "_theme" as const;
const AppThemeSchema = z.enum(["latte", "frappe"]).catch("latte");
export type AppTheme = z.infer<typeof AppThemeSchema>;

export const getThemeServerFn = createServerFn().handler(async () =>
	AppThemeSchema.parse(getCookie(storageKey) || "latte"),
);

const setThemeServerFn = createServerFn({ method: "POST" })
	.inputValidator(AppThemeSchema)
	.handler(({ data }) => {
		setCookie(storageKey, data);
	});

const handleThemeChange = createClientOnlyFn((userTheme: AppTheme) => {
	const validatedTheme = AppThemeSchema.parse(userTheme);

	const root = document.documentElement;
	root.removeAttribute("data-theme");

	root.setAttribute("data-theme", validatedTheme);
});

type ThemeContextProps = {
	theme: AppTheme;
	setTheme: (theme: AppTheme) => Promise<void>;
};
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

type ThemeProviderProps = {
	defaultTheme?: AppTheme;
};
export function ThemeProvider({
	children,
	defaultTheme = "latte",
}: React.PropsWithChildren<ThemeProviderProps>) {
	const [theme, setTheme] = useState<AppTheme>(defaultTheme);

	const _setTheme = async (newUserTheme: AppTheme) => {
		const validatedTheme = AppThemeSchema.parse(newUserTheme);
		setTheme(validatedTheme);
		await setThemeServerFn({ data: validatedTheme });
		handleThemeChange(validatedTheme);
	};

	return (
		<ThemeContext value={{ theme, setTheme: _setTheme }}>
			<ScriptOnce>{`document.documentElement.setAttribute("data-theme", '${defaultTheme}');`}</ScriptOnce>
			{children}
		</ThemeContext>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};

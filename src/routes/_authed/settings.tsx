import {
	createFileRoute,
	Link,
	Outlet,
	useRouteContext,
	useRouterState,
} from "@tanstack/react-router";
import {
	CalendarDaysIcon,
	ChevronDownIcon,
	ImportIcon,
	UserCogIcon,
	UserPenIcon,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/settings")({
	component: SettingsLayout,
});

type SettingsSection = {
	routeId: string;
	href: string;
	label: string;
	description: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	isHidden?: (role: User["role"]) => boolean;
	// CalendarFeed/HolidayImport already render their own heading — skip the
	// wrapper Card header for these so it isn't duplicated underneath it.
	hasOwnHeading?: boolean;
};

const sections: SettingsSection[] = [
	{
		description: t("Name, password and push notifications"),
		href: "/settings/profile",
		icon: UserPenIcon,
		label: t("Profile"),
		routeId: "/_authed/settings/profile",
	},
	{
		description: t("Subscribe to your personal calendar"),
		hasOwnHeading: true,
		href: "/settings/feed",
		icon: CalendarDaysIcon,
		label: t("Calendar Feed"),
		routeId: "/_authed/settings/feed",
	},
	{
		description: t("Holidays and myTischtennis data"),
		hasOwnHeading: true,
		href: "/settings/imports",
		icon: ImportIcon,
		isHidden: (role) => role === "USER",
		label: t("Imports"),
		routeId: "/_authed/settings/imports",
	},
	{
		description: t("Manage club members and invitations"),
		href: "/settings/users",
		icon: UserCogIcon,
		isHidden: (role) => role !== "ADMIN",
		label: t("User Management"),
		routeId: "/_authed/settings/users",
	},
];

function SettingsLayout() {
	const { user } = useRouteContext({ from: "__root__" });
	const activeRouteId = useRouterState({
		select: (state) => state.matches.at(-1)?.routeId,
	});
	const visible = sections.filter((s) => !s.isHidden?.(user?.role ?? "USER"));
	const active =
		sections.find((s) => s.routeId === activeRouteId) ?? sections[0];

	return (
		<div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
			{/* Mobile: a trigger row opens a dropdown to switch sections. */}
			<div className="lg:hidden">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="flex w-full items-center gap-3 rounded-lg bg-card p-3 text-left"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<active.icon className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="font-medium text-sm">{active.label}</div>
								<div className="text-muted-foreground text-xs">
									{active.description}
								</div>
							</div>
							<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72">
						{visible.map((section) => {
							const isActive = section.routeId === activeRouteId;
							return (
								<DropdownMenuItem key={section.href} asChild>
									<Link
										to={section.href}
										className={cn(
											"items-start gap-3 py-2",
											isActive && "bg-primary/10 text-primary",
										)}
									>
										<section.icon className="mt-0.5 size-4 shrink-0" />
										<span className="flex flex-col">
											<span className="font-medium text-sm">
												{section.label}
											</span>
											<span
												className={cn(
													"text-xs",
													isActive
														? "text-primary/70"
														: "text-muted-foreground",
												)}
											>
												{section.description}
											</span>
										</span>
									</Link>
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Desktop: a persistent rail. */}
			<nav className="hidden w-64 shrink-0 rounded-lg bg-card p-2 lg:block">
				<div className="px-2 pt-1 pb-2 font-bold text-lg">{t("Settings")}</div>
				<ul className="flex flex-col gap-0.5">
					{visible.map((section) => {
						const isActive = section.routeId === activeRouteId;
						return (
							<li key={section.href}>
								<Link
									to={section.href}
									className={cn(
										"flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
										isActive
											? "bg-primary/10 text-primary"
											: "text-foreground hover:bg-muted",
									)}
								>
									<section.icon className="mt-0.5 size-4 shrink-0" />
									<span className="flex flex-col">
										<span className="font-medium text-sm">{section.label}</span>
										<span
											className={cn(
												"text-xs",
												isActive ? "text-primary/70" : "text-muted-foreground",
											)}
										>
											{section.description}
										</span>
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Content pane is shared — a single Outlet, not duplicated per
			    breakpoint, since sections hold real forms/fetches/mutations. */}
			<Card className="min-w-0 flex-1">
				{!active.hasOwnHeading && (
					<CardHeader>
						<CardTitle>{active.label}</CardTitle>
						<CardDescription>{active.description}</CardDescription>
					</CardHeader>
				)}
				<CardContent>
					<Outlet />
				</CardContent>
			</Card>
		</div>
	);
}

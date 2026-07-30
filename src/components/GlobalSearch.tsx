import { useNavigate } from "@tanstack/react-router";
import { CalendarIcon, UserIcon, UsersIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { searchAppointments } from "@/api/appointments";
import { searchPlayers } from "@/api/players";
import { searchTeams } from "@/api/teams";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

type SearchType = "appointments" | "players" | "teams" | null;

type SearchItem = {
	id: string;
	title: string;
	subtitle?: string;
	type: SearchType;
	date?: string;
	location?: string;
};

const shortcuts = [
	{
		empty: t("No appointments found"),
		icon: CalendarIcon,
		label: t("Search Appointments"),
		shortcut: "<a",
		type: "appointments" as SearchType,
	},
	{
		empty: t("No players found"),
		icon: UserIcon,
		label: t("Search Players"),
		shortcut: "<p",
		type: "players" as SearchType,
	},
	{
		empty: t("No teams found"),
		icon: UsersIcon,
		label: t("Search Teams"),
		shortcut: "<t",
		type: "teams" as SearchType,
	},
];

export const GlobalSearch = () => {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);

	const [open, setOpen] = useState(false);
	const [searchType, setSearchType] = useState<SearchType>(null);
	const [inputValue, setInputValue] = useState("");
	const [appointments, setAppointments] = useState<SearchItem[]>([]);
	const [players, setPlayers] = useState<SearchItem[]>([]);
	const [teams, setTeams] = useState<SearchItem[]>([]);

	// Global keyboard shortcut to open the search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Cmd+K or Ctrl+K
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen(true);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Reset state when modal closes
	useEffect(() => {
		if (!open) {
			setSearchType(null);
			setInputValue("");
		}
	}, [open]);

	// Search handlers
	const handleSearchAppointments = useCallback(async (query: string) => {
		const result = await searchAppointments({ data: { query } });
		const body = await result.json();
		if (body.data) {
			setAppointments(
				body.data.map((appt) => ({
					date: new Date(appt.startDate).toLocaleDateString("de-de", {
						day: "2-digit",
						month: "2-digit",
						year: "2-digit",
					}),
					id: appt.id,
					location: appt.location ?? undefined,
					subtitle: appt.placements.length
						? t("{0} players", appt.placements.length.toString())
						: undefined,
					title: appt.title,
					type: "appointments" as const,
				})),
			);
		}
	}, []);

	const handleSearchPlayers = useCallback(async (query: string) => {
		const result = await searchPlayers({ data: { query } });
		const body = await result.json();
		if (body.data) {
			setPlayers(
				body.data.map((player) => ({
					ageGroup: calculateAgeGroup(player.year) ?? undefined,
					id: player.id,
					subtitle: `${calculateAgeGroup(player.year)} • QTTR: ${player.qttr}`,
					title: player.name,
					type: "players" as const,
				})),
			);
		}
	}, []);

	const handleSearchTeams = useCallback(async (query: string) => {
		const result = await searchTeams({ data: { query } });
		const body = await result.json();
		if (body.data) {
			setTeams(
				body.data.map((team) => ({
					id: team.id,
					subtitle: team.league ?? undefined,
					title: team.title,
					type: "teams" as const,
				})),
			);
		}
	}, []);

	// Get current items based on search type and filters
	const getCurrentItems = (): SearchItem[] => {
		let items: SearchItem[] = [];

		if (searchType === "appointments") {
			items = appointments;
		} else if (searchType === "players") {
			items = players;
		} else if (searchType === "teams") {
			items = teams;
		}

		return items;
	};

	const currentItems = getCurrentItems();

	const handleInputChange = (value: string) => {
		setInputValue(value);

		// Check for shortcuts
		if (value === "<a") {
			setSearchType("appointments");
			setInputValue("");
			handleSearchAppointments("");
			return;
		}
		if (value === "<p") {
			setSearchType("players");
			setInputValue("");
			handleSearchPlayers("");
			return;
		}
		if (value === "<t") {
			setSearchType("teams");
			setInputValue("");
			handleSearchTeams("");
			return;
		}

		// Trigger search based on current type
		if (searchType === "appointments") {
			handleSearchAppointments(value);
		} else if (searchType === "players") {
			handleSearchPlayers(value);
		} else if (searchType === "teams") {
			handleSearchTeams(value);
		}
	};

	const handleSelectShortcut = (type: SearchType) => {
		setSearchType(type);
		setInputValue("");

		if (type === "appointments") {
			handleSearchAppointments("");
		} else if (type === "players") {
			handleSearchPlayers("");
		} else if (type === "teams") {
			handleSearchTeams("");
		}

		// Focus the input after selecting a search type
		setTimeout(() => {
			inputRef.current?.focus();
		}, 0);
	};

	const handleSelectItem = (item: SearchItem) => {
		if (item.type === "appointments") {
			navigate({ params: { apptId: item.id }, to: "/appts/$apptId" });
		} else if (item.type === "players") {
			navigate({ params: { playerId: item.id }, to: "/players/$playerId" });
		} else if (item.type === "teams") {
			navigate({ params: { teamId: item.id }, to: "/teams/$teamId" });
		}
		setOpen(false);
	};

	const handleBackToShortcuts = useCallback(() => {
		setSearchType(null);
		setInputValue("");
	}, []);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "Escape" && searchType) {
				e.preventDefault();
				handleBackToShortcuts();
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [searchType, handleBackToShortcuts]);

	const handleOpenChange = (newOpen: boolean) => {
		// If trying to close the dialog while a search type is selected,
		// go back to shortcuts instead
		if (!newOpen && searchType) {
			handleBackToShortcuts();
		} else {
			setOpen(newOpen);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogHeader className="sr-only">
				<DialogTitle>{t("Search")}</DialogTitle>
				<DialogDescription>
					{t("Select a search type or use shortcuts")}
				</DialogDescription>
			</DialogHeader>
			<DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
				<Command shouldFilter={false}>
					<div className="flex items-center gap-2 border-b border-border/40 px-3">
						<CommandInput
							ref={inputRef}
							value={inputValue}
							onValueChange={handleInputChange}
							className="h-14 text-base"
							placeholder={
								searchType
									? t("Type to search...")
									: t("Select a search type or use shortcuts")
							}
						/>
						{searchType && (
							<button type="button" onClick={handleBackToShortcuts}>
								<Kbd>ESC</Kbd>
							</button>
						)}
					</div>

					<CommandList className="max-h-96 p-2">
						{!searchType ? (
							<CommandGroup>
								{shortcuts.map((shortcut) => {
									const Icon = shortcut.icon;
									return (
										<CommandItem
											key={shortcut.type}
											value={shortcut.type ?? ""}
											onSelect={() => handleSelectShortcut(shortcut.type)}
											className="gap-3 rounded-lg px-3 py-3"
										>
											<Icon className="size-5 opacity-70" />
											<span className="flex-1 font-medium">
												{shortcut.label}
											</span>
											<Kbd>{shortcut.shortcut}</Kbd>
										</CommandItem>
									);
								})}
							</CommandGroup>
						) : (
							<CommandGroup
								heading={shortcuts.find((s) => s.type === searchType)?.label}
							>
								{currentItems.length > 0 ? (
									currentItems.map((item) => (
										<CommandItem
											key={item.id}
											value={item.id}
											onSelect={() => handleSelectItem(item)}
											className="gap-3 rounded-lg px-3 py-3"
										>
											<div className="flex min-w-0 flex-1 items-center gap-2">
												<span className="font-medium">{item.title}</span>
												{item.subtitle && (
													<span className="text-sm opacity-70">
														{item.subtitle}
													</span>
												)}
											</div>
											{item.location && (
												<span className="whitespace-nowrap text-sm opacity-70">
													{item.location}
												</span>
											)}
											{item.date && (
												<span className="whitespace-nowrap text-sm opacity-70">
													{item.date}
												</span>
											)}
										</CommandItem>
									))
								) : (
									<CommandEmpty>
										{shortcuts.find((s) => s.type === searchType)?.empty}
									</CommandEmpty>
								)}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
};

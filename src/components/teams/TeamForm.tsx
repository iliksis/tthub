import { useForm } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import React from "react";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Player, Season, Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type TeamFormValues = {
	title: string;
	league: string;
	clickTTGroupId: string;
	seasonId: string;
};

type RosterEntry = {
	id: string;
	player: Pick<Player, "id" | "name" | "qttr">;
};

type RosterProps = {
	players: RosterEntry[];
	availablePlayers: Player[];
	sourceOptions: Team[];
	onAdd: (playerId: string) => void;
	onRemove: (teamPlayerId: string) => void;
	onCopy: (sourceTeamId: string) => void;
};

type TeamFormProps = {
	open?: boolean;
	onClose?: () => void;
	submitLabel: string;
	defaultValues?: TeamFormValues;
	// Only passed (and only shown) on create — a Team's season is never
	// editable afterward.
	seasonOptions?: Season[];
	// Only passed (and only shown) on edit — a new team has no id yet to
	// attach a roster to.
	roster?: RosterProps;
	onSubmit: (updates: TeamFormValues) => Promise<void>;
};

function RosterSection({
	players,
	availablePlayers,
	sourceOptions,
	onAdd,
	onRemove,
	onCopy,
}: RosterProps) {
	const sortedAvailable = [...availablePlayers].sort((a, b) =>
		a.name.localeCompare(b.name),
	);
	const sortedPlayers = [...players].sort((a, b) =>
		a.player.name.localeCompare(b.player.name),
	);
	// Both selects are "fire and reset" — picking a value immediately runs
	// the action and the select snaps back to its placeholder rather than
	// keeping the pick displayed, since there's nothing meaningful to keep
	// selected afterward.
	const [playerValue, setPlayerValue] = React.useState<string | undefined>();
	const [sourceValue, setSourceValue] = React.useState<string | undefined>();

	return (
		<Section title={t("Roster")}>
			<div className="flex flex-col gap-3">
				<div className="flex gap-2">
					<Select
						items={Object.fromEntries(
							sortedAvailable.map((p) => [p.id, p.name]),
						)}
						value={playerValue}
						onValueChange={(value) => {
							if (value) onAdd(value);
							setPlayerValue(undefined);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("Choose a player")} />
						</SelectTrigger>
						<SelectContent>
							{sortedAvailable.map((player) => (
								<SelectItem key={player.id} value={player.id}>
									{player.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{sourceOptions.length > 0 && (
					<div className="flex gap-2">
						<Select
							items={Object.fromEntries(
								sourceOptions.map((tm) => [tm.id, tm.title]),
							)}
							value={sourceValue}
							onValueChange={(value) => {
								if (value) onCopy(value);
								setSourceValue(undefined);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("Copy roster from...")} />
							</SelectTrigger>
							<SelectContent>
								{sourceOptions.map((team) => (
									<SelectItem key={team.id} value={team.id}>
										{team.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
				{sortedPlayers.length > 0 && (
					<ul className="flex flex-col gap-1">
						{sortedPlayers.map((entry) => (
							<li
								key={entry.id}
								className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50"
							>
								<span>{entry.player.name}</span>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">
										{entry.player.qttr}
									</span>
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="text-destructive hover:text-destructive"
										aria-label={t("Remove from roster")}
										onClick={() => onRemove(entry.id)}
									>
										<Trash2Icon className="size-3.5" />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</Section>
	);
}

export const TeamForm = ({
	open,
	onClose,
	submitLabel,
	defaultValues = { clickTTGroupId: "", league: "", seasonId: "", title: "" },
	seasonOptions,
	roster,
	onSubmit,
}: TeamFormProps) => {
	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			await onSubmit({ ...value });
		},
	});

	return (
		<Dialog
			open={open ?? false}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.();
			}}
		>
			<DialogContent showCloseButton={false}>
				<DialogTitle className="sr-only">{t("Dialog")}</DialogTitle>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div>
						<form.Field name="title">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Title")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										minLength={2}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div>
						<form.Field name="league">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("League")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										minLength={2}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div>
						<form.Field name="clickTTGroupId">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("click-TT Group Id")}:</Label>
									<Input
										id={field.name}
										aria-invalid={!field.state.meta.isValid}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
					{seasonOptions && (
						<div>
							<form.Field name="seasonId">
								{(field) => (
									<fieldset className="flex flex-col gap-1.5">
										<Label htmlFor={field.name}>{t("Season")}:</Label>
										<Select
											items={Object.fromEntries(
												seasonOptions.map((s) => [s.id, s.name]),
											)}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value ?? "")}
										>
											<SelectTrigger id={field.name} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{seasonOptions.map((season) => (
													<SelectItem key={season.id} value={season.id}>
														{season.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</fieldset>
								)}
							</form.Field>
						</div>
					)}
				</form>
				{roster && <RosterSection {...roster} />}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<Button
						type="submit"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

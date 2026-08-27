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
import { EntitySelect } from "@/components/ui/entity-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Player, Season } from "@/lib/prisma/client";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

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
};

type RosterChanges = {
	adds: string[];
	removes: string[];
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
	onSubmit: (
		updates: TeamFormValues,
		rosterChanges?: RosterChanges,
	) => Promise<void>;
};

const pendingEntryPrefix = "pending-";

function RosterSection({
	players,
	availablePlayers,
	pendingAdds,
	pendingRemoves,
	onAddPending,
	onRemovePending,
}: RosterProps & {
	pendingAdds: string[];
	pendingRemoves: string[];
	onAddPending: (playerId: string) => void;
	onRemovePending: (entryId: string) => void;
}) {
	const removedSet = new Set(pendingRemoves);
	const addedSet = new Set(pendingAdds);
	const sortedAvailable = [...availablePlayers]
		.filter((p) => !addedSet.has(p.id))
		.sort((a, b) => b.qttr - a.qttr);
	const displayedEntries: Array<RosterEntry & { pending?: boolean }> = [
		...players.filter((entry) => !removedSet.has(entry.id)),
		...pendingAdds
			.map((playerId) => availablePlayers.find((p) => p.id === playerId))
			.filter((p): p is Player => !!p)
			.map((player) => ({
				id: `${pendingEntryPrefix}${player.id}`,
				pending: true,
				player,
			})),
	].sort((a, b) => a.player.name.localeCompare(b.player.name));
	// "Fire and reset" — picking a value immediately queues the pending
	// change and the select snaps back to its placeholder rather than
	// keeping the pick displayed, since there's nothing meaningful to keep
	// selected afterward.
	const [playerValue, setPlayerValue] = React.useState<string | undefined>();

	return (
		<Section title={m.teams_roster()}>
			<div className="flex flex-col gap-3">
				<div className="flex gap-2">
					<EntitySelect
						items={sortedAvailable}
						value={playerValue}
						onValueChange={(value) => {
							if (value) onAddPending(value);
							setPlayerValue(undefined);
						}}
						placeholder={m.common_choose_a_player()}
						renderItem={(player) => (
							<>
								{player.name}
								<span className="ml-auto text-muted-foreground text-xs">
									{player.qttr}
								</span>
							</>
						)}
					/>
				</div>
				{displayedEntries.length > 0 && (
					<ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
						{displayedEntries.map((entry) => (
							<li
								key={entry.id}
								className={cn(
									"flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50",
									entry.pending && "italic opacity-70",
								)}
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
										aria-label={m.teams_remove_from_roster()}
										onClick={() => onRemovePending(entry.id)}
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
	const [pendingAdds, setPendingAdds] = React.useState<string[]>([]);
	const [pendingRemoves, setPendingRemoves] = React.useState<string[]>([]);

	React.useEffect(() => {
		if (open) {
			setPendingAdds([]);
			setPendingRemoves([]);
		}
	}, [open]);

	const form = useForm({
		defaultValues,
		onSubmit: async ({ value }) => {
			await onSubmit(
				{ ...value },
				roster ? { adds: pendingAdds, removes: pendingRemoves } : undefined,
			);
			setPendingAdds([]);
			setPendingRemoves([]);
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
				<DialogTitle className="sr-only">{m.common_dialog()}</DialogTitle>
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
									<Label htmlFor={field.name}>{m.common_title()}:</Label>
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
									<Label htmlFor={field.name}>{m.common_league()}:</Label>
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
									<Label htmlFor={field.name}>
										{m.teams_click_tt_group_id()}:
									</Label>
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
										<Label htmlFor={field.name}>{m.common_season()}:</Label>
										<EntitySelect
											id={field.name}
											items={seasonOptions}
											value={field.state.value}
											onValueChange={(value) => field.handleChange(value ?? "")}
										/>
									</fieldset>
								)}
							</form.Field>
						</div>
					)}
				</form>
				{roster && (
					<RosterSection
						{...roster}
						pendingAdds={pendingAdds}
						pendingRemoves={pendingRemoves}
						onAddPending={(playerId) =>
							setPendingAdds((prev) => [...prev, playerId])
						}
						onRemovePending={(entryId) => {
							if (entryId.startsWith(pendingEntryPrefix)) {
								const playerId = entryId.slice(pendingEntryPrefix.length);
								setPendingAdds((prev) => prev.filter((id) => id !== playerId));
							} else {
								setPendingRemoves((prev) => [...prev, entryId]);
							}
						}}
					/>
				)}
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>
						{m.common_close()}
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

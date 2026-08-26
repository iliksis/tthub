import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { addTeamPlayer } from "@/api/teams";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@/hooks/useMutation";
import type { Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type AddPlayerModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	teamId: string;
	players: Player[];
};

export const AddPlayerModal = ({
	open,
	onOpenChange,
	teamId,
	players,
}: AddPlayerModalProps) => {
	const router = useRouter();
	const sortedPlayers = [...players].sort((a, b) =>
		a.name.localeCompare(b.name),
	);

	const addMutation = useMutation({
		fn: addTeamPlayer,
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			onOpenChange(false);
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	const form = useForm({
		defaultValues: { playerId: sortedPlayers[0]?.id ?? "" },
		onSubmit: async ({ value }) => {
			if (!value.playerId) return;
			addMutation.mutate({ data: { playerId: value.playerId, teamId } });
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
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
					<form.Field name="playerId">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Choose a player")}:</Label>
								<Select
									items={Object.fromEntries(
										sortedPlayers.map((p) => [p.id, p.name]),
									)}
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value ?? "")}
								>
									<SelectTrigger id={field.name} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{sortedPlayers.map((player) => (
											<SelectItem key={player.id} value={player.id}>
												{player.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</fieldset>
						)}
					</form.Field>
				</form>
				<DialogFooter>
					<DialogClose render={<Button type="button" variant="outline" />}>
						{t("Close")}
					</DialogClose>
					<Button
						type="submit"
						disabled={sortedPlayers.length === 0}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{t("Add to roster")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

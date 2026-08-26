import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { copyTeamRoster } from "@/api/teams";
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
import type { Team } from "@/lib/prisma/client";
import { t } from "@/lib/text";

type CopyRosterModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	targetTeamId: string;
	sourceOptions: Team[];
};

export const CopyRosterModal = ({
	open,
	onOpenChange,
	targetTeamId,
	sourceOptions,
}: CopyRosterModalProps) => {
	const router = useRouter();

	const copyMutation = useMutation({
		fn: copyTeamRoster,
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
		defaultValues: { sourceTeamId: sourceOptions[0]?.id ?? "" },
		onSubmit: async ({ value }) => {
			if (!value.sourceTeamId) return;
			copyMutation.mutate({
				data: { sourceTeamId: value.sourceTeamId, targetTeamId },
			});
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
					<form.Field name="sourceTeamId">
						{(field) => (
							<fieldset className="flex flex-col gap-1.5">
								<Label htmlFor={field.name}>{t("Choose a team")}:</Label>
								<Select
									items={Object.fromEntries(
										sourceOptions.map((tm) => [tm.id, tm.title]),
									)}
									value={field.state.value}
									onValueChange={(value) => field.handleChange(value ?? "")}
								>
									<SelectTrigger id={field.name} className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{sourceOptions.map((team) => (
											<SelectItem key={team.id} value={team.id}>
												{team.title}
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
						disabled={sourceOptions.length === 0}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						{t("Copy roster from...")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

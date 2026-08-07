import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { createPlacement } from "@/api/placements";
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
import { useMutation } from "@/hooks/useMutation";
import type { Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup } from "@/lib/utils";

type CreateCategoryProps = {
	open: boolean;
	onClose: () => void;
	categories: string[];
	players: Player[];
	appointmentId: string;
};
export const CreatePlacement = ({
	open,
	onClose,
	categories,
	appointmentId,
	players,
}: CreateCategoryProps) => {
	const router = useRouter();

	const createMutation = useMutation({
		fn: createPlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				router.invalidate();
				onClose();
				return;
			}
			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			category: "",
			placement: "",
			player: "",
		},
		onSubmit: async ({ value }) => {
			await createMutation.mutate({
				data: {
					appointmentId,
					category: value.category,
					placement: value.placement,
					playerId: value.player,
				},
			});
		},
	});

	const _onClose = () => {
		onClose();
		form.reset();
	};

	if (!open) return null;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) _onClose();
			}}
		>
			<DialogContent className="md:max-w-xl md:mx-auto">
				<DialogTitle className="sr-only">{t("Dialog")}</DialogTitle>
				<form className="flex flex-col gap-2" onSubmit={form.handleSubmit}>
					<div>
						<form.Field name="player">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Player")}:</Label>
									<Select
										name={field.name}
										value={field.state.value || undefined}
										onValueChange={(value) => field.handleChange(value ?? "")}
										onOpenChange={(open) => {
											if (!open) field.handleBlur();
										}}
									>
										<SelectTrigger id={field.name} className="w-full">
											<SelectValue placeholder={t("Choose a player")} />
										</SelectTrigger>
										<SelectContent>
											{players.map((p) => (
												<SelectItem
													key={p.id}
													value={p.id}
													className="before:content-[attr(data-before)] before:opacity-60"
													data-before={calculateAgeGroup(p.year)}
												>
													{p.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div>
						<form.Field name="category">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Category")}:</Label>
									<Input
										id={field.name}
										list="categories"
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									<datalist id="categories">
										{categories.map((c) => (
											<option key={c} value={c} />
										))}
									</datalist>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div>
						<form.Field name="placement">
							{(field) => (
								<fieldset className="flex flex-col gap-1.5">
									<Label htmlFor={field.name}>{t("Placement")}:</Label>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
				</form>
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
						{t("Create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

import { useRouter } from "@tanstack/react-router";
import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
	createPlacement,
	deletePlacement,
	updatePlacement,
} from "@/api/placements";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useMutation } from "@/hooks/useMutation";
import { groupPlacementsByCategory } from "@/lib/placements";
import type { Placement, Player } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { calculateAgeGroup, cn, createColorForUserId } from "@/lib/utils";

type PlacementsSheetProps = {
	open: boolean;
	onClose: () => void;
	canEdit: boolean;
	placements: (Placement & { player: Player })[];
	players: Player[];
	appointmentId: string;
	categories: string[];
};

function initials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

function placementKey(p: Pick<Placement, "category" | "playerId">) {
	return `${p.category}-${p.playerId}`;
}

export function PlacementsSheet({
	open,
	onClose,
	canEdit,
	placements,
	players,
	appointmentId,
	categories,
}: PlacementsSheetProps) {
	const router = useRouter();
	const isMobile = useIsMobile();
	const prefersReducedMotion = usePrefersReducedMotion();

	// Drag-to-dismiss for the mobile sheet's handle: follows the pointer 1:1
	// while dragging, then either snaps back or closes depending on how far
	// past the threshold the sheet was pulled.
	const dragStartY = React.useRef<number | null>(null);
	const [dragOffset, setDragOffset] = React.useState(0);
	const [isDragging, setIsDragging] = React.useState(false);
	const DISMISS_THRESHOLD = 96;

	const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartY.current = e.clientY;
		setIsDragging(true);
	};

	const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (dragStartY.current === null) return;
		setDragOffset(Math.max(0, e.clientY - dragStartY.current));
	};

	const onHandlePointerEnd = () => {
		dragStartY.current = null;
		setIsDragging(false);
		if (dragOffset > DISMISS_THRESHOLD) onClose();
		setDragOffset(0);
	};

	const grouped = React.useMemo(
		() => groupPlacementsByCategory(placements),
		[placements],
	);
	const realCategories = React.useMemo(
		() => grouped.map((g) => g.category),
		[grouped],
	);

	const [pendingCategories, setPendingCategories] = React.useState<string[]>(
		[],
	);
	React.useEffect(() => {
		setPendingCategories((prev) =>
			prev.filter((c) => !realCategories.includes(c)),
		);
	}, [realCategories]);

	const [editingKey, setEditingKey] = React.useState<string | null>(null);
	const [draft, setDraft] = React.useState("");
	const [justSavedKey, setJustSavedKey] = React.useState<string | null>(null);
	const [addingToCategory, setAddingToCategory] = React.useState<string | null>(
		null,
	);
	const [newPlayerId, setNewPlayerId] = React.useState("");
	const [composingCategory, setComposingCategory] = React.useState(false);
	const [newCategoryName, setNewCategoryName] = React.useState("");

	const createMutation = useMutation({
		fn: createPlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				return;
			}
			toast.error(data.message);
		},
	});

	const updateMutation = useMutation({
		fn: updatePlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				return;
			}
			toast.error(data.message);
		},
	});

	const deleteMutation = useMutation({
		fn: deletePlacement,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				return;
			}
			toast.error(data.message);
		},
	});

	const startEdit = (p: Placement) => {
		setEditingKey(placementKey(p));
		setDraft(p.placement ?? "");
	};

	const commitEdit = async (p: Placement) => {
		const k = placementKey(p);
		setEditingKey(null);
		await updateMutation.mutate({
			data: {
				appointmentId: p.appointmentId,
				category: p.category,
				playerId: p.playerId,
				updates: { placement: draft },
			},
		});
		setJustSavedKey(k);
		window.setTimeout(() => {
			setJustSavedKey((current) => (current === k ? null : current));
		}, 900);
	};

	const onDeletePlacement = (p: Placement) => async () => {
		await deleteMutation.mutate({
			data: {
				appointmentId: p.appointmentId,
				category: p.category,
				playerId: p.playerId,
			},
		});
	};

	const addPlayerToCategory = async (category: string) => {
		if (!newPlayerId) return;
		await createMutation.mutate({
			data: { appointmentId, category, playerId: newPlayerId },
		});
		setNewPlayerId("");
		setAddingToCategory(null);
	};

	const displayCategories = [...realCategories, ...pendingCategories];
	const categoryNameTaken = displayCategories.some(
		(c) => c.toLowerCase() === newCategoryName.trim().toLowerCase(),
	);

	const createCategory = () => {
		const name = newCategoryName.trim();
		if (!name || categoryNameTaken) return;
		setPendingCategories((prev) => [...prev, name]);
		setNewCategoryName("");
		setComposingCategory(false);
	};

	return (
		<Sheet
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<SheetContent
				side={isMobile ? "bottom" : "right"}
				className={cn(
					isMobile
						? "max-h-[85vh] w-full rounded-t-2xl duration-300"
						: "w-full sm:max-w-lg",
				)}
				style={
					dragOffset > 0
						? {
								transform: `translateY(${dragOffset}px)`,
								transitionDuration:
									isDragging || prefersReducedMotion ? "0ms" : undefined,
							}
						: undefined
				}
				showCloseButton={false}
			>
				{isMobile && (
					<div
						className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
						onPointerDown={onHandlePointerDown}
						onPointerMove={onHandlePointerMove}
						onPointerUp={onHandlePointerEnd}
						onPointerCancel={onHandlePointerEnd}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
				)}
				<SheetHeader>
					<SheetTitle>{t("Participants")}</SheetTitle>
				</SheetHeader>
				<div className="flex-1 overflow-y-auto px-4 pb-4">
					<div className="flex flex-col gap-4">
						{displayCategories.map((category) => {
							const rows =
								grouped.find((g) => g.category === category)?.placements ?? [];
							const usedIds = new Set(rows.map((r) => r.playerId));
							const available = players.filter((p) => !usedIds.has(p.id));

							return (
								<div
									key={category}
									className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
								>
									<div className="flex items-center justify-between border-border/60 border-b bg-muted/30 px-4 py-2.5">
										<h3 className="font-bold text-sm">{category}</h3>
										<Badge variant="outline">{rows.length}</Badge>
									</div>

									<div className="flex flex-col">
										{rows.map((p) => {
											const isEditing = editingKey === placementKey(p);
											const justSaved = justSavedKey === placementKey(p);
											const color = createColorForUserId(p.player.id);
											return (
												<div
													key={placementKey(p)}
													className="group flex items-center gap-3 border-border/40 border-b px-4 py-3 last:border-0 hover:bg-accent/40"
												>
													<Avatar size="sm">
														<AvatarFallback
															style={{
																backgroundColor: color.backgroundColor,
																color: color.foregroundColor,
															}}
														>
															{initials(p.player.name)}
														</AvatarFallback>
													</Avatar>
													<div className="flex-1">
														<div className="text-sm">{p.player.name}</div>
														<div className="text-muted-foreground text-xs">
															{calculateAgeGroup(p.player.year)}
														</div>
													</div>
													{canEdit && isEditing ? (
														<Input
															autoFocus
															value={draft}
															onChange={(e) => setDraft(e.target.value)}
															onBlur={() => commitEdit(p)}
															onKeyDown={(e) => {
																if (e.key === "Enter") commitEdit(p);
																if (e.key === "Escape") setEditingKey(null);
															}}
															className="h-7 w-20"
														/>
													) : (
														<button
															type="button"
															disabled={!canEdit}
															onClick={() => startEdit(p)}
															className={cn(
																"flex h-7 min-w-11 items-center justify-center gap-1 rounded-full border px-2.5 font-medium text-xs transition-colors disabled:pointer-events-none",
																p.placement
																	? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
																	: "border-border text-muted-foreground hover:bg-muted",
																justSaved &&
																	"border-success/30 bg-success/15 text-success",
															)}
														>
															{p.placement || t("Pending")}
															{justSaved && <CheckIcon className="size-3" />}
														</button>
													)}
													{canEdit && (
														<Button
															type="button"
															variant="ghost"
															size="icon-sm"
															className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
															onClick={onDeletePlacement(p)}
														>
															<Trash2Icon className="size-3.5" />
														</Button>
													)}
												</div>
											);
										})}
										{rows.length === 0 && (
											<div className="px-4 py-4 text-center text-muted-foreground text-xs italic">
												{t("No participants yet")}
											</div>
										)}
									</div>

									{canEdit && (
										<div className="border-border/40 border-t px-4 py-2.5">
											{addingToCategory === category ? (
												<div className="flex items-center gap-1.5">
													<Select
														value={newPlayerId}
														onValueChange={(value) =>
															setNewPlayerId(value ?? "")
														}
													>
														<SelectTrigger className="h-7 w-full">
															<SelectValue placeholder={t("Choose a player")}>
																{(value: string) =>
																	players.find((p) => p.id === value)?.name
																}
															</SelectValue>
														</SelectTrigger>
														<SelectContent>
															{available.map((p) => (
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
													<Button
														type="button"
														size="sm"
														disabled={!newPlayerId}
														onClick={() => addPlayerToCategory(category)}
													>
														{t("Create")}
													</Button>
												</div>
											) : (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="text-muted-foreground"
													onClick={() => setAddingToCategory(category)}
													disabled={available.length === 0}
												>
													<PlusIcon className="size-3.5" />
													{t("Add participant")}
												</Button>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>

					{canEdit && (
						<div className="mt-4 rounded-xl border border-border border-dashed p-3">
							{composingCategory ? (
								<div className="flex items-center gap-1.5">
									<Input
										autoFocus
										list="placement-categories"
										value={newCategoryName}
										onChange={(e) => setNewCategoryName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") createCategory();
											if (e.key === "Escape") {
												setComposingCategory(false);
												setNewCategoryName("");
											}
										}}
										placeholder={t("Category")}
										className="h-8"
									/>
									<datalist id="placement-categories">
										{categories.map((c) => (
											<option key={c} value={c} />
										))}
									</datalist>
									<Button
										type="button"
										size="sm"
										disabled={!newCategoryName.trim() || categoryNameTaken}
										onClick={createCategory}
									>
										{t("Create")}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => {
											setComposingCategory(false);
											setNewCategoryName("");
										}}
									>
										<XIcon className="size-3.5" />
									</Button>
								</div>
							) : (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-full justify-center text-muted-foreground"
									onClick={() => setComposingCategory(true)}
								>
									<PlusIcon className="size-3.5" />
									{t("New category")}
								</Button>
							)}
							{composingCategory && categoryNameTaken && (
								<p className="mt-1.5 text-destructive text-xs">
									{t("Category already exists")}
								</p>
							)}
						</div>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

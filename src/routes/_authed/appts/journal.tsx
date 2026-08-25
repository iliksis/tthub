import {
	createFileRoute,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { z } from "zod";
import { getTransactionsPage } from "@/api/appointments";
import { LoadMoreFooter } from "@/components/appointments/LoadMoreFooter";
import { TransactionDetail } from "@/components/appointments/TransactionDetail";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useDragToDismiss } from "@/hooks/use-drag-to-dismiss";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useLoadMoreBatch } from "@/hooks/useLoadMoreBatch";
import type { Appointment, Transaction, User } from "@/lib/prisma/client";
import { TransactionType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import {
	getChangedFields,
	type TransactionChanges,
	transactionActionBadge,
} from "@/lib/transactionLabels";
import {
	cn,
	createColorForUserId,
	formatRelativeTime,
	shortenUserName,
} from "@/lib/utils";

const BATCH_SIZE = 25;

const journalSearchSchema = z.object({
	query: z.string().optional(),
	skip: z.number().int().nonnegative().optional(),
	type: z.enum(["CREATE", "UPDATE", "DELETE", "RESTORE"]).optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/journal")({
	component: RouteComponent,
	validateSearch: journalSearchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const response = await getTransactionsPage({
			data: {
				query: deps.query,
				skip,
				take: BATCH_SIZE,
				type: deps.type,
			},
		});
		const data = response.data ?? {
			grandTotal: 0,
			matchedTotal: 0,
			transactions: [],
		};
		return { ...data, skip };
	},
	head: () => ({
		meta: [{ title: t("Transaction Journal") }],
	}),
});

type TransactionWithRelations = Transaction & {
	user: User | null;
	appointment: Appointment;
};

const typeFilters: { value: TransactionType | "ALL"; label: string }[] = [
	{ label: t("All actions"), value: "ALL" },
	{ label: t("Created"), value: TransactionType.CREATE },
	{ label: t("Changed"), value: TransactionType.UPDATE },
	{ label: t("Deleted"), value: TransactionType.DELETE },
	{ label: t("Restored"), value: TransactionType.RESTORE },
];

// Icon + past-participle shown inline in each row's sentence — distinct from
// transactionActionBadge's capitalized labels, which read correctly only as
// standalone badges, not mid-sentence.
const actionIcon: Record<TransactionType, typeof PlusIcon> = {
	CREATE: PlusIcon,
	DELETE: Trash2Icon,
	RESTORE: RotateCcwIcon,
	UPDATE: PencilIcon,
};
const actionParticiple: Record<TransactionType, string> = {
	CREATE: t("created"),
	DELETE: t("deleted"),
	RESTORE: t("restored"),
	UPDATE: t("changed"),
};
const actionTextClass: Record<"success" | "destructive" | "info", string> = {
	destructive: "text-destructive",
	info: "text-info",
	success: "text-success",
};

const dateHeaderFmt = (d: Date | string) =>
	new Date(d).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "long",
		weekday: "long",
	});

function groupByDay(items: TransactionWithRelations[]) {
	const groups = new Map<string, TransactionWithRelations[]>();
	for (const item of items) {
		const key = new Date(item.createdAt).toDateString();
		const list = groups.get(key) ?? [];
		list.push(item);
		groups.set(key, list);
	}
	return [...groups.entries()];
}

type TransactionRowProps = {
	item: TransactionWithRelations;
	isSelected: boolean;
	isNew: boolean;
	onClick: () => void;
};

function TransactionRow({
	item,
	isSelected,
	isNew,
	onClick,
}: TransactionRowProps) {
	const badge = transactionActionBadge(item.type);
	const Icon = actionIcon[item.type];
	const textClass = actionTextClass[badge.variant];
	const fields = getChangedFields(item.changes as TransactionChanges | null);
	const userColor = item.user ? createColorForUserId(item.user.id) : null;

	return (
		<button
			type="button"
			data-testid="journal-row"
			onClick={onClick}
			className={cn(
				"relative flex w-full items-start gap-3 rounded-md py-2.5 pr-2 pl-5 text-left transition-colors",
				isSelected ? "bg-muted" : "hover:bg-muted/40",
				isNew && "fade-in slide-in-from-top-1 animate-in duration-200 ease-out",
			)}
		>
			<span
				className={cn(
					"-left-2.5 absolute top-3 flex size-5 items-center justify-center rounded-full bg-background ring-4 ring-background",
					textClass,
				)}
			>
				<Icon className="size-3.5" />
			</span>
			<Avatar size="sm" className={cn("shrink-0", !item.user && "opacity-50")}>
				<AvatarFallback
					style={
						userColor
							? {
									backgroundColor: userColor.backgroundColor,
									color: userColor.foregroundColor,
								}
							: undefined
					}
				>
					{item.user ? shortenUserName(item.user.name) : "—"}
				</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="text-sm leading-snug">
					<span className="font-medium">
						{item.user?.name ?? t("Deleted user")}
					</span>{" "}
					{t("has")}{" "}
					<span className="font-medium">{item.appointment.shortTitle}</span>{" "}
					<span className={textClass}>{actionParticiple[item.type]}</span>
					{fields.length > 0 && (
						<span className="text-muted-foreground">
							{" "}
							({fields.join(", ")})
						</span>
					)}
				</div>
				<span className="text-muted-foreground text-xs">
					{formatRelativeTime(item.createdAt)}
				</span>
			</div>
		</button>
	);
}

function RouteComponent() {
	const {
		transactions: batch,
		matchedTotal,
		grandTotal,
		skip,
	} = Route.useLoaderData();
	const search = Route.useSearch();
	const router = useRouter();
	const isNavigating = useRouterState({ select: (s) => s.isLoading });
	const prefersReducedMotion = usePrefersReducedMotion();
	const isMobile = useIsMobile();

	const [queryInput, setQueryInput] = React.useState(search.query ?? "");
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const { dragOffset, isDragging, handlePointerHandlers } = useDragToDismiss(
		() => setSelectedId(null),
	);

	const filterKey = `${search.query ?? ""}|${search.type ?? ""}`;
	const { items, appended } = useLoadMoreBatch(batch, skip, filterKey);
	const newIds = React.useMemo(
		() => new Set(appended.map((t) => t.id)),
		[appended],
	);

	const searchRef = React.useRef(search);
	searchRef.current = search;
	const routerRef = React.useRef(router);
	routerRef.current = router;

	// Debounced so typing doesn't fire a loader request per keystroke; the
	// input itself still updates instantly for a responsive feel.
	React.useEffect(() => {
		const timeout = setTimeout(() => {
			const current = searchRef.current;
			if (queryInput !== (current.query ?? "")) {
				routerRef.current.navigate({
					replace: true,
					search: {
						query: queryInput || undefined,
						type: current.type,
					},
					to: ".",
				});
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [queryInput]);

	const onTypeChange = (value: TransactionType | "ALL") => {
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				type: value === "ALL" ? undefined : value,
			},
			to: ".",
		});
	};

	const onLoadMore = () => {
		router.navigate({
			replace: true,
			search: {
				query: search.query,
				skip: items.length,
				type: search.type,
			},
			to: ".",
		});
	};

	const selected = items.find((item) => item.id === selectedId) ?? null;
	const remaining = matchedTotal - items.length;
	const groups = groupByDay(items);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="font-bold text-lg">{t("Transaction Journal")}</h1>
				<p className="text-muted-foreground text-sm">
					{t(
						"{0} of {1} events",
						matchedTotal.toString(),
						grandTotal.toString(),
					)}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder={t("Search appointment or person...")}
					value={queryInput}
					onChange={(e) => setQueryInput(e.target.value)}
					className="w-64"
				/>
				<Select
					value={search.type ?? "ALL"}
					onValueChange={(v) => onTypeChange(v as TransactionType | "ALL")}
				>
					<SelectTrigger size="sm" className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{typeFilters.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1fr_360px]">
				{items.length === 0 ? (
					<div className="py-8 text-center text-muted-foreground">
						{t("No items found")}
					</div>
				) : (
					<div className="flex flex-col">
						{groups.map(([day, dayItems]) => (
							<div key={day}>
								<div className="sticky top-0 z-10 bg-background py-1.5 pl-3 font-bold text-muted-foreground text-xs uppercase tracking-wider">
									{dateHeaderFmt(dayItems[0].createdAt)}
								</div>
								<div className="relative ml-3.5 flex flex-col border-border/60 border-l pb-2">
									{dayItems.map((item) => (
										<TransactionRow
											key={item.id}
											item={item}
											isSelected={item.id === selectedId}
											isNew={!prefersReducedMotion && newIds.has(item.id)}
											onClick={() =>
												setSelectedId(item.id === selectedId ? null : item.id)
											}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				)}

				<div className="hidden lg:sticky lg:top-6 lg:block lg:h-fit">
					{selected ? (
						<div className="rounded-lg bg-card p-4">
							<TransactionDetail transaction={selected} />
						</div>
					) : (
						<div className="rounded-lg border border-border/60 border-dashed p-4 text-center text-muted-foreground text-sm">
							{t("Select a row to see details")}
						</div>
					)}
				</div>
			</div>

			<LoadMoreFooter
				itemCount={items.length}
				remaining={remaining}
				matchedTotal={matchedTotal}
				isNavigating={isNavigating}
				batchSize={BATCH_SIZE}
				onLoadMore={onLoadMore}
			/>

			<Sheet
				open={!!selected && isMobile}
				onOpenChange={(open) => !open && setSelectedId(null)}
			>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t-0 duration-300 lg:hidden"
					style={
						dragOffset > 0
							? {
									transform: `translateY(${dragOffset}px)`,
									transitionDuration:
										isDragging || prefersReducedMotion ? "0ms" : undefined,
								}
							: undefined
					}
				>
					<SheetTitle className="sr-only">{t("Details")}</SheetTitle>
					<div
						className="flex shrink-0 cursor-grab touch-none justify-center pt-2 pb-1 active:cursor-grabbing"
						{...handlePointerHandlers}
					>
						<div className="h-1.5 w-9 rounded-full bg-muted-foreground/30" />
					</div>
					{selected && (
						<div className="px-4 pb-6">
							<TransactionDetail transaction={selected} />
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}

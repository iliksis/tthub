import {
	createFileRoute,
	Link,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import React from "react";
import { z } from "zod";
import { getTransactionsPage } from "@/api/appointments";
import { TransactionDetail } from "@/components/appointments/TransactionDetail";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
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
import { TableRow } from "@/components/ui/table";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
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
	type: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
});

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/journal")({
	component: RouteComponent,
	validateSearch: journalSearchSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps }) => {
		const skip = deps.skip ?? 0;
		const res = await getTransactionsPage({
			data: { query: deps.query, skip, take: BATCH_SIZE, type: deps.type },
		});
		const response = await res.json();
		if (res.status < 400) {
			const data = response.data ?? {
				grandTotal: 0,
				matchedTotal: 0,
				transactions: [],
			};
			return { ...data, skip };
		}
		throw new Error(response.message);
	},
	head: () => ({
		meta: [{ title: t("Transaction Journal") }],
	}),
});

type TransactionWithRelations = Transaction & {
	user: User;
	appointment: Appointment;
};

const typeFilters: { value: TransactionType | "ALL"; label: string }[] = [
	{ label: t("All actions"), value: "ALL" },
	{ label: t("Created"), value: TransactionType.CREATE },
	{ label: t("Changed"), value: TransactionType.UPDATE },
	{ label: t("Deleted"), value: TransactionType.DELETE },
];

const getTransactionColumns =
	(): DetailsListColumn<TransactionWithRelations>[] => [
		{
			key: "time",
			label: t("Time"),
			render: (item) => (
				<span className="whitespace-nowrap text-muted-foreground text-xs">
					{formatRelativeTime(item.createdAt)}
				</span>
			),
			sortable: true,
			sortFn: (a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		},
		{
			key: "person",
			label: t("Person"),
			render: (item) => {
				const color = createColorForUserId(item.user.id);
				return (
					<div className="flex items-center gap-2">
						<Avatar size="sm" className="shrink-0">
							<AvatarFallback
								style={{
									backgroundColor: color.backgroundColor,
									color: color.foregroundColor,
								}}
							>
								{shortenUserName(item.user.name)}
							</AvatarFallback>
						</Avatar>
						<span className="text-sm">{item.user.name}</span>
					</div>
				);
			},
		},
		{
			key: "appointment",
			label: t("Appointment"),
			render: (item) => (
				<Link
					to="/appts/$apptId"
					params={{ apptId: item.appointment.id }}
					onClick={(e) => e.stopPropagation()}
					className="truncate text-sm underline decoration-border underline-offset-2 hover:decoration-foreground"
				>
					{item.appointment.shortTitle}
				</Link>
			),
		},
		{
			key: "action",
			label: t("Action"),
			render: (item) => {
				const badge = transactionActionBadge(item.type);
				return <Badge variant={badge.variant}>{badge.label}</Badge>;
			},
		},
		{
			key: "changed",
			label: t("Changed"),
			render: (item) => {
				const fields = getChangedFields(
					item.changes as TransactionChanges | null,
				);
				return (
					<span className="text-muted-foreground text-xs">
						{fields.length > 0
							? t("{0} fields changed", fields.length.toString())
							: "—"}
					</span>
				);
			},
		},
	];

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

	const [queryInput, setQueryInput] = React.useState(search.query ?? "");
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	// The loader only ever fetches one batch (skip/take), never the whole
	// list again — so the previously loaded rows are kept in state and the
	// new batch is appended to them, unless the filters changed (or this is
	// the first page), in which case it replaces them outright. Comparing
	// against state (not a ref) during render is the React-sanctioned way to
	// reset/derive state when an input changes without a useEffect round-trip.
	const filterKey = `${search.query ?? ""}|${search.type ?? ""}`;
	const [items, setItems] = React.useState(batch);
	const [appliedLoad, setAppliedLoad] = React.useState({ filterKey, skip });
	const [newIds, setNewIds] = React.useState<ReadonlySet<string>>(new Set());
	if (appliedLoad.filterKey !== filterKey || appliedLoad.skip !== skip) {
		const isFreshView = skip === 0 || appliedLoad.filterKey !== filterKey;
		setAppliedLoad({ filterKey, skip });
		setItems((prev) => (isFreshView ? batch : [...prev, ...batch]));
		setNewIds(isFreshView ? new Set() : new Set(batch.map((t) => t.id)));
	}

	// Debounced so typing doesn't fire a loader request per keystroke; the
	// input itself still updates instantly for a responsive feel.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only re-runs when the local input changes; search.query/type/router are read, not resynced on
	React.useEffect(() => {
		const timeout = setTimeout(() => {
			if (queryInput !== (search.query ?? "")) {
				router.navigate({
					replace: true,
					search: { query: queryInput || undefined, type: search.type },
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

			{/* Table and detail rail are siblings in the same row, so they start
			    flush with each other instead of the rail trailing the header. */}
			<div className="grid gap-4 lg:grid-cols-[1fr_360px]">
				<div className="flex min-w-0 flex-col gap-3 overflow-x-auto rounded-lg bg-card p-3">
					<DetailsList
						items={items}
						getItemId={(item) => item.id}
						columns={getTransactionColumns()}
						onRenderRow={(item, children) => {
							const isNew = !prefersReducedMotion && newIds.has(item.id);
							return (
								<TableRow
									key={item.id}
									className={cn(
										"h-11 cursor-pointer",
										item.id === selectedId && "bg-muted",
										isNew &&
											"fade-in slide-in-from-top-1 animate-in duration-200 ease-out",
									)}
									onClick={() =>
										setSelectedId(item.id === selectedId ? null : item.id)
									}
								>
									{children}
								</TableRow>
							);
						}}
						selectMode="none"
					/>

					{items.length > 0 &&
						(remaining > 0 ? (
							<div className="flex justify-center border-border/60 border-t pt-3">
								<Button
									variant="outline"
									className="w-full"
									disabled={isNavigating}
									onClick={onLoadMore}
								>
									{isNavigating && <Loader2Icon className="animate-spin" />}
									{isNavigating
										? t("Loading…")
										: t(
												"Load {0} more ({1} remaining)",
												Math.min(BATCH_SIZE, remaining).toString(),
												remaining.toString(),
											)}
								</Button>
							</div>
						) : (
							<div className="flex justify-center border-border/60 border-t pt-3">
								<span className="text-muted-foreground text-xs">
									{t(
										"You've reached the end — {0} events",
										matchedTotal.toString(),
									)}
								</span>
							</div>
						))}
				</div>
				<div className="lg:sticky lg:top-6 lg:h-fit">
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
		</div>
	);
}

import { createFileRoute, Link } from "@tanstack/react-router";
import React from "react";
import { getAllTransactions } from "@/api/appointments";
import { TransactionDetail } from "@/components/appointments/TransactionDetail";
import { DetailsList, type DetailsListColumn } from "@/components/DetailsList";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TableRow } from "@/components/ui/table";
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

export const Route = createFileRoute("/_authed/appts/journal")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: t("Transaction Journal") }],
	}),
	loader: async () => {
		const res = await getAllTransactions();
		const response = await res.json();
		if (res.status < 400) {
			return { transactions: response.data ?? [] };
		}
		throw new Error(response.message);
	},
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
	const { transactions } = Route.useLoaderData();
	const [query, setQuery] = React.useState("");
	const [type, setType] = React.useState<TransactionType | "ALL">("ALL");
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const filtered = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		let items = transactions.filter((item) =>
			type === "ALL" ? true : item.type === type,
		);
		if (q) {
			items = items.filter(
				(item) =>
					item.appointment.title.toLowerCase().includes(q) ||
					item.appointment.shortTitle.toLowerCase().includes(q) ||
					item.user.name.toLowerCase().includes(q),
			);
		}
		return items;
	}, [transactions, query, type]);

	const selected = filtered.find((item) => item.id === selectedId) ?? null;

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h1 className="font-bold text-lg">{t("Transaction Journal")}</h1>
				<p className="text-muted-foreground text-sm">
					{t(
						"{0} of {1} events",
						filtered.length.toString(),
						transactions.length.toString(),
					)}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					placeholder={t("Search appointment or person...")}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="w-64"
				/>
				<Select
					value={type}
					onValueChange={(v) => setType(v as TransactionType | "ALL")}
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
				<div className="min-w-0 overflow-x-auto rounded-lg bg-card">
					<DetailsList
						items={filtered}
						getItemId={(item) => item.id}
						columns={getTransactionColumns()}
						onRenderRow={(item, children) => (
							<TableRow
								key={item.id}
								className={cn(
									"h-11 cursor-pointer",
									item.id === selectedId && "bg-muted",
								)}
								onClick={() =>
									setSelectedId(item.id === selectedId ? null : item.id)
								}
							>
								{children}
							</TableRow>
						)}
						selectMode="none"
					/>
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

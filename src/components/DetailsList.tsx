import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type RowSelectionState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronsDownUp, ChevronUp } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export type DetailsListColumn<T> = {
	key: string;
	label: string;
	render: (item: T) => React.ReactNode;
	minWidth?: string;
	align?: "left" | "right" | "center";
	sortable?: boolean;
	sortFn?: (a: T, b: T) => number;
};

export type CommandBarItem<T> = {
	key: string;
	label: string;
	icon?: React.ReactNode;
	onClick?: (selectedItems: T[]) => void;
	isDisabled?: (selectedItems: T[]) => boolean;
	onlyIcon?: boolean;
	variant?: "primary" | "secondary" | "error" | "ghost";
	dropdown?: {
		items: Array<{
			key: string;
			label: string;
			icon?: React.ReactNode;
			onClick: (selectedItems: T[]) => void;
			isDisabled?: (selectedItems: T[]) => boolean;
		}>;
	};
};

type DetailsListProps<T> = {
	items: T[];
	columns: DetailsListColumn<T>[];
	getItemId: (item: T) => string;
	onItemClick?: (item: T) => void | Promise<void>;
	onRenderRow?: (item: T, children: React.ReactNode) => React.ReactNode;
	commandBarItems?: CommandBarItem<T>[];
	emptyMessage?: string;
	className?: string;
	selectMode?: "multiple" | "single" | "none";
	// When provided, sorting is controlled by the parent (e.g. to drive a
	// server-side sorted/paginated fetch) instead of TanStack Table sorting
	// whatever rows happen to be loaded client-side.
	sorting?: SortingState;
	onSortingChange?: (sorting: SortingState) => void;
};

const commandBarButtonVariant = (
	variant: CommandBarItem<unknown>["variant"],
) => {
	if (variant === "error") return "destructive" as const;
	if (variant === "primary") return "default" as const;
	if (variant === "secondary") return "secondary" as const;
	return "ghost" as const;
};

export function DetailsList<T>({
	items,
	columns,
	getItemId,
	onItemClick,
	onRenderRow,
	commandBarItems = [],
	emptyMessage = t("No items found"),
	className = "",
	selectMode = "multiple",
	sorting: controlledSorting,
	onSortingChange,
}: DetailsListProps<T>) {
	const [internalSorting, setInternalSorting] = React.useState<SortingState>(
		[],
	);
	const sorting = controlledSorting ?? internalSorting;
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

	// Convert custom columns to TanStack Table column definitions
	const tableColumns = React.useMemo<ColumnDef<T>[]>(() => {
		const cols: ColumnDef<T>[] = [];

		// Add selection column if needed
		if (selectMode !== "none") {
			cols.push({
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(checked) => row.toggleSelected(checked === true)}
						onClick={(e) => e.stopPropagation()}
					/>
				),
				enableSorting: false,
				header: ({ table }) => {
					if (selectMode === "multiple") {
						return (
							<Checkbox
								checked={table.getIsAllRowsSelected()}
								indeterminate={table.getIsSomeRowsSelected()}
								onCheckedChange={(checked) =>
									table.toggleAllRowsSelected(checked === true)
								}
							/>
						);
					}
					return null;
				},
				id: "select",
				size: 48,
			});
		}

		// Add data columns
		for (const column of columns) {
			cols.push({
				accessorFn: (row) => row,
				cell: ({ getValue }) => column.render(getValue() as T),
				enableSorting: column.sortable ?? false,
				header: column.label,
				id: column.key,
				minSize: column.minWidth
					? Number.parseInt(column.minWidth, 10)
					: undefined,
				sortingFn: column.sortFn
					? // biome-ignore lint/style/noNonNullAssertion: Cannot be null here
						(rowA, rowB) => column.sortFn!(rowA.original, rowB.original)
					: undefined,
			});
		}

		return cols;
	}, [columns, selectMode]);

	const table = useReactTable({
		columns: tableColumns,
		data: items,
		enableMultiRowSelection: selectMode === "multiple",
		enableRowSelection: selectMode !== "none",
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => getItemId(row),
		// When sorting is controlled, the parent is responsible for fetching
		// the data in the requested order (e.g. server-side sort across a
		// paginated dataset) rather than the table resorting whatever rows
		// happen to be loaded client-side.
		getSortedRowModel: controlledSorting ? undefined : getSortedRowModel(),
		manualSorting: !!controlledSorting,
		onRowSelectionChange: (updater) => {
			if (selectMode === "single") {
				// For single mode, only allow one selection
				const newSelection =
					typeof updater === "function" ? updater(rowSelection) : updater;
				const selectedIds = Object.keys(newSelection).filter(
					(key) => newSelection[key],
				);
				if (selectedIds.length > 1) {
					// Keep only the most recently selected
					const lastSelected = selectedIds[selectedIds.length - 1];
					setRowSelection({ [lastSelected]: true });
				} else {
					setRowSelection(newSelection);
				}
			} else {
				setRowSelection(updater);
			}
		},
		onSortingChange: (updater) => {
			const next = typeof updater === "function" ? updater(sorting) : updater;
			if (onSortingChange) {
				onSortingChange(next);
			} else {
				setInternalSorting(next);
			}
		},
		state: {
			rowSelection,
			sorting,
		},
	});

	const selectedItems = table
		.getSelectedRowModel()
		.rows.map((row) => row.original);

	const handleItemClick = (item: T, e: React.MouseEvent) => {
		// Prevent triggering row click when clicking checkbox
		if ((e.target as HTMLElement).closest("button[role='checkbox']")) {
			return;
		}
		if (onItemClick) {
			onItemClick(item);
		}
	};

	if (items.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			{commandBarItems.length > 0 && (
				<>
					<div className="flex gap-2 flex-wrap items-center">
						<div className="flex gap-2 ml-auto flex-wrap">
							{commandBarItems.map((commandItem) => {
								const isDisabled = commandItem.isDisabled?.(selectedItems);
								const variant = commandBarButtonVariant(commandItem.variant);

								// Render dropdown if dropdown items are provided
								if (commandItem.dropdown) {
									return (
										<DropdownMenu key={commandItem.key}>
											<DropdownMenuTrigger
												render={
													<Button
														type="button"
														size="sm"
														variant={variant}
														disabled={isDisabled}
														title={commandItem.label}
													/>
												}
											>
												{commandItem.icon}
												{commandItem.onlyIcon ? null : commandItem.label}
												<ChevronDown className="size-3" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-60">
												{commandItem.dropdown.items.map((dropdownItem) => {
													const isDropdownDisabled =
														dropdownItem.isDisabled?.(selectedItems) ?? false;

													return (
														<DropdownMenuItem
															key={dropdownItem.key}
															disabled={isDropdownDisabled}
															onClick={() =>
																dropdownItem.onClick(selectedItems)
															}
														>
															{dropdownItem.icon}
															{dropdownItem.label}
														</DropdownMenuItem>
													);
												})}
											</DropdownMenuContent>
										</DropdownMenu>
									);
								}

								return (
									<Button
										type="button"
										size="sm"
										variant={variant}
										key={commandItem.key}
										onClick={() => commandItem.onClick?.(selectedItems)}
										disabled={isDisabled}
										title={commandItem.label}
									>
										{commandItem.icon}
										{commandItem.onlyIcon ? null : commandItem.label}
									</Button>
								);
							})}
						</div>
					</div>
					<Separator />
				</>
			)}

			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} className="hover:bg-transparent">
							{headerGroup.headers.map((header) => {
								const align = columns.find(
									(c) => c.key === header.column.id,
								)?.align;
								return (
									<TableHead
										key={header.id}
										style={{
											minWidth: header.column.columnDef.minSize,
											width:
												header.column.id === "select"
													? header.column.getSize()
													: undefined,
										}}
										className={cn(
											header.column.getCanSort() &&
												"cursor-pointer select-none",
											align === "right" && "text-right",
											align === "center" && "text-center",
										)}
										onClick={header.column.getToggleSortingHandler()}
									>
										{header.isPlaceholder ? null : (
											<div
												className={cn(
													"flex items-center gap-1",
													align === "right" && "justify-end",
													align === "center" && "justify-center",
												)}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
												{header.column.getCanSort() && (
													<span className="inline-flex flex-col">
														{header.column.getIsSorted() === "asc" ? (
															<ChevronUp className="size-4" />
														) : header.column.getIsSorted() === "desc" ? (
															<ChevronDown className="size-4" />
														) : (
															<ChevronsDownUp className="size-4" />
														)}
													</span>
												)}
											</div>
										)}
									</TableHead>
								);
							})}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => {
						const children = (
							<>
								{row.getVisibleCells().map((cell) => {
									const align = columns.find(
										(c) => c.key === cell.column.id,
									)?.align;
									return (
										<TableCell
											key={cell.id}
											className={cn(
												align === "right" && "text-right",
												align === "center" && "text-center",
											)}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									);
								})}
							</>
						);

						if (onRenderRow) {
							return onRenderRow(row.original, children);
						}

						return (
							<TableRow
								key={row.id}
								className={cn(
									"h-10 cursor-pointer",
									row.getIsSelected() && "bg-muted",
								)}
								onClick={(e) => handleItemClick(row.original, e)}
							>
								{children}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

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
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

export type DetailsListColumn<T> = {
	key: string;
	label: string;
	render: (item: T) => React.ReactNode;
	minWidth?: string;
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
}: DetailsListProps<T>) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

	// Convert custom columns to TanStack Table column definitions
	const tableColumns = React.useMemo<ColumnDef<T>[]>(() => {
		const cols: ColumnDef<T>[] = [];

		// Add selection column if needed
		if (selectMode !== "none") {
			cols.push({
				cell: ({ row }) => (
					<label className="cursor-pointer flex items-center justify-center">
						<input
							type="checkbox"
							checked={row.getIsSelected()}
							onChange={row.getToggleSelectedHandler()}
							className="checkbox checkbox-sm"
							onClick={(e) => e.stopPropagation()}
						/>
					</label>
				),
				enableSorting: false,
				header: ({ table }) => {
					if (selectMode === "multiple") {
						return (
							<label className="cursor-pointer flex items-center justify-center">
								<input
									type="checkbox"
									checked={table.getIsAllRowsSelected()}
									ref={(el) => {
										if (el) {
											el.indeterminate = table.getIsSomeRowsSelected();
										}
									}}
									onChange={table.getToggleAllRowsSelectedHandler()}
									className="checkbox checkbox-sm"
								/>
							</label>
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
				minSize: column.minWidth ? Number.parseInt(column.minWidth) : undefined,
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
		getSortedRowModel: getSortedRowModel(),
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
		onSortingChange: setSorting,
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
		if ((e.target as HTMLElement).closest("input[type='checkbox']")) {
			return;
		}
		if (onItemClick) {
			onItemClick(item);
		}
	};

	if (items.length === 0) {
		return (
			<div className="text-center py-8 text-base-content/60">
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

								// Render dropdown if dropdown items are provided
								if (commandItem.dropdown) {
									return (
										<div key={commandItem.key} className="dropdown">
											<button
												type="button"
												tabIndex={0}
												disabled={isDisabled}
												title={commandItem.label}
												className={cn(
													"btn btn-sm",
													commandItem.variant === "error" && "btn-error",
													commandItem.variant === "primary" && "btn-primary",
													commandItem.variant === "secondary" &&
														"btn-secondary",
													commandItem.variant === "ghost" && "btn-ghost",
												)}
											>
												{commandItem.icon && (
													<span className="w-4 h-4">{commandItem.icon}</span>
												)}
												{commandItem.onlyIcon ? null : commandItem.label}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="12"
													height="12"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
													aria-hidden="true"
												>
													<polyline points="6 9 12 15 18 9" />
												</svg>
											</button>
											<ul
												tabIndex={-1}
												className="dropdown-content menu bg-base-200 rounded-box w-60 p-2 shadow"
											>
												{commandItem.dropdown.items.map((dropdownItem) => {
													const isDropdownDisabled =
														dropdownItem.isDisabled?.(selectedItems) ?? false;

													return (
														<li key={dropdownItem.key}>
															<button
																type="button"
																onClick={() =>
																	dropdownItem.onClick(selectedItems)
																}
																disabled={isDropdownDisabled}
																className={cn(
																	"flex items-center gap-2",
																	isDropdownDisabled &&
																		"opacity-50 cursor-not-allowed",
																)}
															>
																{dropdownItem.icon && (
																	<span className="w-4 h-4">
																		{dropdownItem.icon}
																	</span>
																)}
																{dropdownItem.label}
															</button>
														</li>
													);
												})}
											</ul>
										</div>
									);
								}

								return (
									<button
										type="button"
										key={commandItem.key}
										onClick={() => commandItem.onClick?.(selectedItems)}
										disabled={isDisabled}
										title={commandItem.label}
										className={`btn btn-sm ${
											commandItem.variant === "error"
												? "btn-error"
												: commandItem.variant === "primary"
													? "btn-primary"
													: commandItem.variant === "secondary"
														? "btn-secondary"
														: "btn-ghost"
										}`}
									>
										{commandItem.icon && (
											<span className="w-4 h-4">{commandItem.icon}</span>
										)}
										{commandItem.onlyIcon ? null : commandItem.label}
									</button>
								);
							})}
						</div>
					</div>
					<div className="divider h-1 m-0"></div>
				</>
			)}

			<div className="overflow-x-auto">
				<table className="table table-sm">
					<thead>
						{table.getHeaderGroups().map((headerGroup) => (
							<tr key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<th
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
										)}
										onClick={header.column.getToggleSortingHandler()}
									>
										{header.isPlaceholder ? null : (
											<div className="flex items-center gap-1">
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
									</th>
								))}
							</tr>
						))}
					</thead>
					<tbody>
						{table.getRowModel().rows.map((row) => {
							const children = (
								<>
									{row.getVisibleCells().map((cell) => (
										<td key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</td>
									))}
								</>
							);

							if (onRenderRow) {
								return onRenderRow(row.original, children);
							}

							return (
								<tr
									key={row.id}
									className={cn(
										"h-10 hover:bg-base-300 cursor-pointer",
										row.getIsSelected() && "bg-base-200",
									)}
									onClick={(e) => handleItemClick(row.original, e)}
								>
									{children}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

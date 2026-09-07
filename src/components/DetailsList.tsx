import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	type ColumnDef,
	columnSizingFeature,
	createSortedRowModel,
	flexRender,
	type RowData,
	type RowSelectionState,
	rowSelectionFeature,
	rowSortingFeature,
	type SortingState,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import {
	ChevronDown,
	ChevronsDownUp,
	ChevronUp,
	GripVerticalIcon,
} from "lucide-react";
import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

// Module-level (not recreated per render) so useSensor's internal useMemo,
// keyed on each options object's identity, actually holds across renders.
const pointerSensorOptions = { activationConstraint: { distance: 4 } };
const keyboardSensorOptions = { coordinateGetter: sortableKeyboardCoordinates };

const features = tableFeatures({
	columnSizingFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
});

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
	// When provided, row selection is controlled by the parent (e.g. to
	// implement a "select all matching filters" mode spanning rows beyond
	// what's currently loaded) instead of being tracked internally.
	selection?: RowSelectionState;
	onSelectionChange?: (
		updater:
			| RowSelectionState
			| ((old: RowSelectionState) => RowSelectionState),
	) => void;
	// When provided, rows get a drag handle and become reorderable; on drop,
	// this is called with `items` in their new order (the parent owns
	// persisting it — this component has no concept of "saving").
	onReorder?: (newItems: T[]) => void;
};

export const commandBarButtonVariant = (
	variant: CommandBarItem<unknown>["variant"],
) => {
	if (variant === "error") return "destructive" as const;
	if (variant === "primary") return "default" as const;
	if (variant === "secondary") return "secondary" as const;
	return "ghost" as const;
};

export function DetailsList<T extends RowData>({
	items,
	columns,
	getItemId,
	onItemClick,
	onRenderRow,
	commandBarItems = [],
	emptyMessage = m.common_no_items_found(),
	className = "",
	selectMode = "multiple",
	sorting: controlledSorting,
	onSortingChange,
	selection: controlledSelection,
	onSelectionChange,
	onReorder,
}: DetailsListProps<T>) {
	const dragSensors = useSensors(
		useSensor(PointerSensor, pointerSensorOptions),
		useSensor(KeyboardSensor, keyboardSensorOptions),
	);
	const [internalSorting, setInternalSorting] = React.useState<SortingState>(
		[],
	);
	const sorting = controlledSorting ?? internalSorting;
	const [internalRowSelection, setInternalRowSelection] =
		React.useState<RowSelectionState>({});
	const rowSelection = controlledSelection ?? internalRowSelection;
	const applySelection = onSelectionChange ?? setInternalRowSelection;
	// Anchor for shift-click range selection, tracking the last row that was
	// explicitly (non-shift) selected/deselected.
	const lastSelectedRowIdRef = React.useRef<string | null>(null);
	// Indirection so the checkbox column (defined before `table` exists) can
	// call the range-selection logic (defined after `table` exists).
	const selectRangeRef = React.useRef<(targetRowId: string) => void>(() => {});

	// Convert custom columns to TanStack Table column definitions
	const tableColumns = React.useMemo<ColumnDef<typeof features, T>[]>(() => {
		const cols: ColumnDef<typeof features, T>[] = [];

		// Add selection column if needed
		if (selectMode !== "none") {
			cols.push({
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(checked, eventDetails) => {
							const nativeEvent = eventDetails.event as MouseEvent | undefined;
							if (selectMode === "multiple" && nativeEvent?.shiftKey) {
								selectRangeRef.current?.(row.id);
							} else {
								row.toggleSelected(checked === true);
								lastSelectedRowIdRef.current = row.id;
							}
						}}
						onClick={(e) => e.stopPropagation()}
					/>
				),
				enableSorting: false,
				header: ({ table }) => {
					if (selectMode === "multiple") {
						return (
							<Checkbox
								checked={table.getIsAllRowsSelected()}
								indeterminate={
									table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
								}
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
				sortFn: column.sortFn
					? // biome-ignore lint/style/noNonNullAssertion: Cannot be null here
						(rowA, rowB) => column.sortFn!(rowA.original, rowB.original)
					: undefined,
			});
		}

		return cols;
	}, [columns, selectMode]);

	const table = useTable({
		columns: tableColumns,
		data: items,
		enableMultiRowSelection: selectMode === "multiple",
		enableRowSelection: selectMode !== "none",
		features,
		getRowId: (row) => getItemId(row),
		// When sorting is controlled, the parent is responsible for fetching
		// the data in the requested order (e.g. server-side sort across a
		// paginated dataset) rather than the table resorting whatever rows
		// happen to be loaded client-side.
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
					applySelection({ [lastSelected]: true });
				} else {
					applySelection(newSelection);
				}
			} else {
				applySelection(updater);
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

	// Selects every row between the last explicitly (non-shift) clicked row
	// and `targetRowId`, in the table's current display order, without
	// disturbing selections outside that range.
	const selectRange = React.useCallback(
		(targetRowId: string) => {
			const rows = table.getRowModel().rows;
			const anchorId = lastSelectedRowIdRef.current;
			const anchorIndex = anchorId
				? rows.findIndex((r) => r.id === anchorId)
				: -1;
			const targetIndex = rows.findIndex((r) => r.id === targetRowId);
			if (targetIndex === -1) return;
			if (anchorIndex === -1) {
				rows[targetIndex].toggleSelected();
				lastSelectedRowIdRef.current = targetRowId;
				return;
			}
			const start = Math.min(anchorIndex, targetIndex);
			const end = Math.max(anchorIndex, targetIndex);
			applySelection((old) => {
				const next = { ...old };
				for (let i = start; i <= end; i++) {
					next[rows[i].id] = true;
				}
				return next;
			});
		},
		[table, applySelection],
	);
	selectRangeRef.current = selectRange;

	const handleItemClick = (
		row: ReturnType<typeof table.getRowModel>["rows"][number],
		e: React.MouseEvent,
	) => {
		// Prevent triggering row selection when clicking an interactive control
		// (checkboxes, buttons, links, dropdown triggers, etc.) rendered inside a
		// column's render() — only a plain click on the row body should select it.
		if (
			(e.target as HTMLElement).closest(
				"button, a, [role='menuitem'], input, select",
			)
		) {
			return;
		}
		if (selectMode === "multiple" && e.shiftKey) {
			selectRange(row.id);
			return;
		}
		if (selectMode !== "none") {
			row.toggleSelected();
			lastSelectedRowIdRef.current = row.id;
		}
		if (onItemClick) {
			onItemClick(row.original);
		}
	};

	const handleDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (!onReorder || !over || active.id === over.id) return;
		const oldIndex = items.findIndex((item) => getItemId(item) === active.id);
		const newIndex = items.findIndex((item) => getItemId(item) === over.id);
		if (oldIndex === -1 || newIndex === -1) return;
		onReorder(arrayMove(items, oldIndex, newIndex));
	};

	const renderCells = (
		row: ReturnType<typeof table.getRowModel>["rows"][number],
	) =>
		row.getAllCells().map((cell) => {
			const align = columns.find((c) => c.key === cell.column.id)?.align;
			return (
				<TableCell
					key={cell.id}
					className={cn(
						align === "right" && "text-right",
						align === "center" && "text-center",
					)}
				>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</TableCell>
			);
		});

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
													<button
														type="button"
														className={cn(
															buttonVariants({ size: "sm", variant }),
														)}
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

			{items.length === 0 ? (
				<div className="text-center py-8 text-muted-foreground">
					{emptyMessage}
				</div>
			) : (
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{onReorder && <TableHead className="w-8" />}
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
					{onReorder ? (
						<DndContext sensors={dragSensors} onDragEnd={handleDragEnd}>
							<SortableContext
								items={table.getRowModel().rows.map((row) => row.id)}
								strategy={verticalListSortingStrategy}
							>
								<TableBody>
									{table.getRowModel().rows.map((row) => (
										<SortableRow
											key={row.id}
											rowId={row.id}
											isSelected={row.getIsSelected()}
											onMouseDown={(e) => {
												if (e.shiftKey) e.preventDefault();
											}}
											onClick={(e) => handleItemClick(row, e)}
										>
											{renderCells(row)}
										</SortableRow>
									))}
								</TableBody>
							</SortableContext>
						</DndContext>
					) : (
						<TableBody>
							{table.getRowModel().rows.map((row) => {
								const children = renderCells(row);

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
										onMouseDown={(e) => {
											// Avoid the browser's native text-selection drag when
											// shift-clicking to select a range of rows.
											if (e.shiftKey) e.preventDefault();
										}}
										onClick={(e) => handleItemClick(row, e)}
									>
										{children}
									</TableRow>
								);
							})}
						</TableBody>
					)}
				</Table>
			)}
		</div>
	);
}

// Extracted so `useSortable` (a hook) can be called once per row rather than
// inside the row-rendering .map — hooks can't be called conditionally/in a
// loop directly, so each row needs its own component instance.
function SortableRow({
	rowId,
	isSelected,
	onMouseDown,
	onClick,
	children,
}: {
	rowId: string;
	isSelected: boolean;
	onMouseDown: (e: React.MouseEvent) => void;
	onClick: (e: React.MouseEvent) => void;
	children: React.ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: rowId });

	return (
		<TableRow
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"h-10 cursor-pointer",
				isSelected && "bg-muted",
				isDragging && "relative z-10 bg-accent",
			)}
			onMouseDown={onMouseDown}
			onClick={onClick}
		>
			<TableCell
				className="w-8 cursor-grab touch-none px-2 text-muted-foreground active:cursor-grabbing"
				onClick={(e) => e.stopPropagation()}
				{...attributes}
				{...listeners}
			>
				<GripVerticalIcon className="size-4" />
			</TableCell>
			{children}
		</TableRow>
	);
}

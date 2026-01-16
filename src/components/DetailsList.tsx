import React from "react";
import { cn } from "@/lib/utils";

export type DetailsListColumn<T> = {
	key: string;
	label: string;
	render: (item: T) => React.ReactNode;
	minWidth?: string;
};

export type CommandBarItem<T> = {
	key: string;
	label: string;
	icon?: React.ReactNode;
	onClick: (selectedItems: T[]) => void;
	isDisabled?: (selectedItems: T[]) => boolean;
	onlyIcon?: boolean;
	variant?: "primary" | "secondary" | "error" | "ghost";
};

type DetailsListProps<T> = {
	items: T[];
	columns: DetailsListColumn<T>[];
	getItemId: (item: T) => string;
	onItemClick?: (item: T) => void;
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
	emptyMessage = "No items found",
	className = "",
	selectMode = "multiple",
}: DetailsListProps<T>) {
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

	const selectedItems = items.filter((item) =>
		selectedIds.has(getItemId(item)),
	);

	const allSelected = items.length > 0 && selectedIds.size === items.length;
	const someSelected = selectedIds.size > 0 && !allSelected;

	const handleSelectAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(items.map(getItemId)));
		}
	};

	const handleSelectItem = (itemId: string) => {
		if (selectMode === "single") {
			// Single mode: only one item can be selected
			if (selectedIds.has(itemId)) {
				setSelectedIds(new Set());
			} else {
				setSelectedIds(new Set([itemId]));
			}
		} else {
			// Multiple mode: toggle selection
			const newSelection = new Set(selectedIds);
			if (newSelection.has(itemId)) {
				newSelection.delete(itemId);
			} else {
				newSelection.add(itemId);
			}
			setSelectedIds(newSelection);
		}
	};

	const handleItemClick = (item: T, e: React.MouseEvent) => {
		// Prevent triggering row click when clicking checkbox
		if ((e.target as HTMLElement).closest("input[type='checkbox']")) {
			return;
		}
		if (onItemClick) {
			onItemClick(item);
		} else {
			handleSelectItem(getItemId(item));
		}
	};

	if (items.length === 0) {
		return (
			<div className="text-center py-8 text-base-content/60">
				{emptyMessage}
			</div>
		);
	}

	const renderRow = (item: T) => {
		const itemId = getItemId(item);
		const isSelected = selectedIds.has(itemId);

		const children = (
			<>
				{selectMode !== "none" && (
					<td>
						<label className="cursor-pointer flex items-center justify-center">
							<input
								type="checkbox"
								checked={isSelected}
								onChange={() => handleSelectItem(itemId)}
								className="checkbox checkbox-sm"
								onClick={(e) => e.stopPropagation()}
							/>
						</label>
					</td>
				)}
				{columns.map((column) => (
					<td key={column.key}>{column.render(item)}</td>
				))}
			</>
		);

		if (onRenderRow) {
			return onRenderRow(item, children);
		}

		return (
			<tr
				key={itemId}
				className={cn(
					"h-10 hover:bg-base-200 cursor-pointer",
					isSelected && "bg-base-200",
				)}
				onClick={(e) => handleItemClick(item, e)}
			>
				{children}
			</tr>
		);
	};

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			{commandBarItems.length > 0 && (
				<div className="flex gap-2 flex-wrap items-center border-b border-base-300 pb-4">
					<div className="flex gap-2 ml-auto flex-wrap">
						{commandBarItems.map((commandItem) => {
							const isDisabled = commandItem.isDisabled?.(selectedItems);

							return (
								<button
									type="button"
									key={commandItem.key}
									onClick={() => commandItem.onClick(selectedItems)}
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
			)}

			<div className="overflow-x-auto">
				<table className="table table-sm">
					<thead>
						<tr>
							{selectMode === "multiple" && (
								<th className="w-12">
									<label className="cursor-pointer flex items-center justify-center">
										<input
											type="checkbox"
											checked={allSelected}
											ref={(el) => {
												if (el) {
													el.indeterminate = someSelected;
												}
											}}
											onChange={handleSelectAll}
											className="checkbox checkbox-sm"
										/>
									</label>
								</th>
							)}
							{selectMode === "single" && <th className="w-12" />}
							{columns.map((column) => (
								<th key={column.key} style={{ minWidth: column.minWidth }}>
									{column.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>{items.map(renderRow)}</tbody>
				</table>
			</div>
		</div>
	);
}

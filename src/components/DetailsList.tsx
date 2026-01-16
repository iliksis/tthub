import React from "react";
import { t } from "@/lib/text";
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
	emptyMessage = t("No items found"),
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

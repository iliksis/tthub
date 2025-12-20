import { SearchIcon } from "lucide-react";
import React, { useId } from "react";
import { cn } from "@/lib/utils";

type CommandModalProps = {
	open?: boolean;
	onClose?: () => void;
	className?: string;
	items?: string[];
	onSelectItem?: (item: string) => void;
};

export const CommandModal = ({
	open,
	className,
	onClose,
	items = [],
	onSelectItem,
}: React.PropsWithChildren<CommandModalProps>) => {
	const id = useId();
	const dialogProps = open ? { open: true } : {};

	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const [filteredItems, setFilteredItems] = React.useState<typeof items>(items);
	const [inputValue, setInputValue] = React.useState("");

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFilteredItems(
			items.filter((item) =>
				item.toLowerCase().includes(e.target.value.toLowerCase()),
			),
		);
		setSelectedIndex(0);
		setInputValue(e.target.value);
	};

	const nextItem = () => {
		let nextIndex = selectedIndex + 1;
		if (nextIndex > filteredItems.length - 1) {
			nextIndex = 0;
		}
		setSelectedIndex(nextIndex);
	};

	const previousItem = () => {
		let prevIndex = selectedIndex - 1;
		if (prevIndex < 0) {
			prevIndex = filteredItems.length - 1;
		}
		setSelectedIndex(prevIndex);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			nextItem();
		} else if (e.key === "ArrowUp") {
			previousItem();
		} else if (e.key === "Enter") {
			if (filteredItems.length > 0) {
				const item = filteredItems[selectedIndex];
				onSelectItem?.(item);
			} else if (inputValue.length > 0) {
				onSelectItem?.(inputValue);
			}
		}
	};

	if (!open) return null;

	return (
		<dialog
			id={`modal_${id}`}
			className={cn("modal", className)}
			onClose={onClose}
			{...dialogProps}
		>
			<div className="modal-box p-0">
				<label className="input input-lg input-ghost w-full">
					<SearchIcon className="size-4 opacity-50" />
					<input
						type="search"
						placeholder="Search..."
						autoFocus={true}
						onChange={onChange}
						onKeyDown={onKeyDown}
					/>
				</label>
				<ul className="list max-h-[300px] overflow-y-auto">
					{filteredItems.length > 0 ? (
						filteredItems.map((item, i) => (
							<div
								key={item}
								role="option"
								tabIndex={0}
								aria-selected={i === selectedIndex}
								className="list-row aria-selected:bg-base-content/10 hover:bg-base-content/5 hover:cursor-pointer"
								onKeyDown={() => onSelectItem?.(item)}
								onClick={() => onSelectItem?.(item)}
							>
								{item}
							</div>
						))
					) : (
						<li className="list-row">
							No items found{" "}
							{inputValue && `- Create '${inputValue}' by pressing Enter`}
						</li>
					)}
				</ul>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit">close</button>
			</form>
		</dialog>
	);
};

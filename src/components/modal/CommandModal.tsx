import React from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type CommandModalProps = {
	open?: boolean;
	onClose?: () => void;
	items?: string[];
	onSelectItem?: (item: string) => void;
};

export const CommandModal = ({
	open,
	onClose,
	items = [],
	onSelectItem,
}: React.PropsWithChildren<CommandModalProps>) => {
	const [inputValue, setInputValue] = React.useState("");

	const filteredItems = items.filter((item) =>
		item.toLowerCase().includes(inputValue.toLowerCase()),
	);

	return (
		<Dialog
			open={open ?? false}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose?.();
			}}
		>
			<DialogHeader className="sr-only">
				<DialogTitle>Command Palette</DialogTitle>
				<DialogDescription>Search for an item to select</DialogDescription>
			</DialogHeader>
			<DialogContent className="overflow-hidden p-0">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search..."
						value={inputValue}
						onValueChange={setInputValue}
						onKeyDown={(e) => {
							if (
								e.key === "Enter" &&
								filteredItems.length === 0 &&
								inputValue.length > 0
							) {
								onSelectItem?.(inputValue);
							}
						}}
					/>
					<CommandList>
						{filteredItems.length > 0 ? (
							<CommandGroup>
								{filteredItems.map((item) => (
									<CommandItem key={item} onSelect={() => onSelectItem?.(item)}>
										{item}
									</CommandItem>
								))}
							</CommandGroup>
						) : (
							<CommandEmpty>
								No items found
								{inputValue && ` - Create '${inputValue}' by pressing Enter`}
							</CommandEmpty>
						)}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
};

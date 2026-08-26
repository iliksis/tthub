import type * as React from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type EntityOption = { id: string; name: string };

type EntitySelectProps<T extends EntityOption> = {
	items: T[];
	value?: string;
	onValueChange: (value: string | undefined) => void;
	placeholder?: string;
	id?: string;
	className?: string;
	renderItem?: (item: T) => React.ReactNode;
};

export function EntitySelect<T extends EntityOption>({
	items,
	value,
	onValueChange,
	placeholder,
	id,
	className,
	renderItem,
}: EntitySelectProps<T>) {
	return (
		<Select
			items={Object.fromEntries(items.map((item) => [item.id, item.name]))}
			value={value}
			onValueChange={(nextValue) => onValueChange(nextValue ?? undefined)}
		>
			<SelectTrigger id={id} className={cn("w-full", className)}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.id} value={item.id}>
						{renderItem ? renderItem(item) : item.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

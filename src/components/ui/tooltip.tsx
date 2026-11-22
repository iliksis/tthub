import {
	TooltipArrow as TooltipArrowPrimitive,
	TooltipContent as TooltipContentPrimitive,
	Tooltip as TooltipPrimitive,
	TooltipTrigger as TooltipTriggerPrimitive,
} from "@ui-sdk/react/tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive>) {
	return <TooltipPrimitive {...props} />;
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipTriggerPrimitive>) {
	return <TooltipTriggerPrimitive data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	children,
	...props
}: Omit<React.ComponentProps<typeof TooltipContentPrimitive>, "children"> & {
	children?: React.ReactNode;
}) {
	return (
		<TooltipContentPrimitive
			data-slot="tooltip-content"
			className={cn(
				"z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background transition-[opacity,scale] duration-150 has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-95 data-starting-style:opacity-0",
				className,
			)}
			{...props}
		>
			{children}
			<TooltipArrowPrimitive className="z-50 size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1 data-[side=top]:-bottom-1" />
		</TooltipContentPrimitive>
	);
}

export { Tooltip, TooltipContent, TooltipTrigger };

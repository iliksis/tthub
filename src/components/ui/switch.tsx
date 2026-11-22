"use client";

import { Switch as SwitchPrimitive, SwitchThumb } from "@ui-sdk/react/switch";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Switch({
	className,
	...props
}: React.ComponentProps<typeof SwitchPrimitive>) {
	return (
		<SwitchPrimitive
			data-slot="switch"
			className={cn(
				"peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-input bg-input/40 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-primary data-checked:bg-primary",
				className,
			)}
			{...props}
		>
			<SwitchThumb
				data-slot="switch-thumb"
				className="pointer-events-none block size-3.5 translate-x-0.5 rounded-full bg-background shadow-xs transition-transform duration-150 ease-out data-checked:translate-x-[18px]"
			/>
		</SwitchPrimitive>
	);
}

export { Switch };

import {
	CollapsiblePanel,
	Collapsible as CollapsiblePrimitive,
	CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@ui-sdk/react/collapsible";
import type * as React from "react";

function Collapsible({
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive>) {
	return <CollapsiblePrimitive data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
	...props
}: React.ComponentProps<typeof CollapsibleTriggerPrimitive>) {
	return (
		<CollapsibleTriggerPrimitive data-slot="collapsible-trigger" {...props} />
	);
}

function CollapsibleContent({
	...props
}: React.ComponentProps<typeof CollapsiblePanel>) {
	return <CollapsiblePanel data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };

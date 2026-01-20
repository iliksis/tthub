import { createLink } from "@tanstack/react-router";
import React from "react";
import { cn } from "@/lib/utils";

interface BasicLinkProps
	extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

const BasicLink = React.forwardRef<HTMLAnchorElement, BasicLinkProps>(
	(props, ref) => {
		return (
			<a
				ref={ref}
				{...props}
				className={cn("link link-hover text-accent", props.className)}
			/>
		);
	},
);

export const InternalLink = createLink(BasicLink);

import {
	type LinkComponentProps,
	Link as TanstackLink,
} from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const linkClassName =
	"inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5";

type InternalLinkProps = LinkComponentProps<"a"> & { external?: false };
type ExternalLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
	external: true;
	href: string;
};

export function Link(props: InternalLinkProps | ExternalLinkProps) {
	if (props.external) {
		const { external: _external, className, children, ...rest } = props;
		return (
			<a
				{...rest}
				target="_blank"
				rel="noopener noreferrer"
				className={cn(linkClassName, className)}
			>
				{children}
				<ExternalLinkIcon />
			</a>
		);
	}

	const { external: _external, className, children, ...rest } = props;
	return (
		<TanstackLink {...rest} className={cn(linkClassName, className)}>
			{children}
		</TanstackLink>
	);
}

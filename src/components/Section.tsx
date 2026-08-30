import type { ReactNode } from "react";

type SectionProps = {
	title: string;
	description?: string;
	className?: string;
	children: ReactNode;
};

export function Section({
	title,
	description,
	className,
	children,
}: SectionProps) {
	return (
		<div className={className}>
			<div className="mb-3 flex flex-wrap items-center gap-2.5">
				<span className="font-bold text-xs uppercase tracking-wider">
					{title}
				</span>
				<span className="h-px flex-1 bg-accent-foreground/55" />
				{description && (
					<span className="text-muted-foreground text-xs basis-full lg:basis-auto">
						{description}
					</span>
				)}
			</div>
			{children}
		</div>
	);
}

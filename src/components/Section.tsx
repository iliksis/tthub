import type { ReactNode } from "react";

type SectionProps = {
	title: string;
	children: ReactNode;
};

export function Section({ title, children }: SectionProps) {
	return (
		<div>
			<div className="mb-3 flex items-center gap-2.5">
				<span className="font-bold text-xs uppercase tracking-wider">
					{title}
				</span>
				<span className="h-px flex-1 bg-accent-foreground/55" />
			</div>
			{children}
		</div>
	);
}

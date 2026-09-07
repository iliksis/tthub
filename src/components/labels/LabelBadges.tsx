import type { LabelColor } from "@/api/labels";
import { Badge } from "@/components/ui/badge";
import { cn, getCatppuccinColorStyle } from "@/lib/utils";

export type LabelBadgeData = { id: string; name: string; color: string };

type LabelBadgesProps = {
	labels: LabelBadgeData[];
	className?: string;
};

export function LabelBadges({ labels, className }: LabelBadgesProps) {
	if (labels.length === 0) return null;

	return (
		<div className={cn("flex flex-wrap items-center gap-1", className)}>
			{labels.map((label) => {
				const style = getCatppuccinColorStyle(label.color as LabelColor);
				return (
					<Badge
						key={label.id}
						style={{
							backgroundColor: style.backgroundColor,
						}}
					>
						{label.name}
					</Badge>
				);
			})}
		</div>
	);
}

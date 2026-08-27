import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

type LoadMoreFooterProps = {
	itemCount: number;
	remaining: number;
	matchedTotal: number;
	isNavigating: boolean;
	batchSize: number;
	onLoadMore: () => void;
};

export function LoadMoreFooter({
	itemCount,
	remaining,
	matchedTotal,
	isNavigating,
	batchSize,
	onLoadMore,
}: LoadMoreFooterProps) {
	if (itemCount === 0) return null;

	if (remaining > 0) {
		return (
			<div className="flex justify-center border-border/60 border-t pt-3">
				<Button
					variant="outline"
					className="w-full"
					disabled={isNavigating}
					onClick={onLoadMore}
				>
					{isNavigating && <Loader2Icon className="animate-spin" />}
					{isNavigating
						? m.common_loading()
						: m.appointments_load_n_more_n_remaining({
								param1: Math.min(batchSize, remaining).toString(),
								param2: remaining.toString(),
							})}
				</Button>
			</div>
		);
	}

	return (
		<div className="flex justify-center border-border/60 border-t pt-3">
			<span className="text-muted-foreground text-xs">
				{m.appointments_you_ve_reached_the_end_n_events({
					param1: matchedTotal.toString(),
				})}
			</span>
		</div>
	);
}

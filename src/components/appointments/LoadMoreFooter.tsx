import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/text";

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
						? t("Loading…")
						: t(
								"Load {0} more ({1} remaining)",
								Math.min(batchSize, remaining).toString(),
								remaining.toString(),
							)}
				</Button>
			</div>
		);
	}

	return (
		<div className="flex justify-center border-border/60 border-t pt-3">
			<span className="text-muted-foreground text-xs">
				{t("You've reached the end — {0} events", matchedTotal.toString())}
			</span>
		</div>
	);
}

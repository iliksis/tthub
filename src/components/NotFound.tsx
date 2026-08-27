import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export function NotFound() {
	return (
		<div className="flex h-svh flex-col items-center justify-center gap-2 px-4 text-center">
			<span className="font-bold text-8xl text-muted-foreground/25 tabular-nums">
				404
			</span>
			<h1 className="font-bold text-lg">{m.common_page_not_found()}</h1>
			<p className="max-w-sm text-muted-foreground text-sm">
				{m.common_this_address_doesn_t_exist_or_has_been_moved()}
			</p>
			<Button variant="outline" className="mt-4" render={<Link to="/" />}>
				{m.common_back_to_dashboard()}
			</Button>
		</div>
	);
}

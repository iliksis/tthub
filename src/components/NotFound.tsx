import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/text";

export function NotFound() {
	return (
		<div className="flex h-svh flex-col items-center justify-center gap-2 px-4 text-center">
			<span className="font-bold text-8xl text-muted-foreground/25 tabular-nums">
				404
			</span>
			<h1 className="font-bold text-lg">{t("Page not found")}</h1>
			<p className="max-w-sm text-muted-foreground text-sm">
				{t("This address doesn't exist or has been moved.")}
			</p>
			<Button variant="outline" className="mt-4" render={<Link to="/" />}>
				{t("Back to dashboard")}
			</Button>
		</div>
	);
}

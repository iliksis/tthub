import * as Sentry from "@sentry/tanstackstart-react";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { t } from "@/lib/text";

export function ErrorPage({ error }: { error: Error }) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className="flex flex-col items-center justify-center gap-2 px-4 mt-10 text-center">
			<div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<TriangleAlertIcon className="size-7" />
			</div>
			<h1 className="font-bold text-lg">{t("An Error occurred")}</h1>
			<p className="max-w-sm text-muted-foreground text-sm">{error.message}</p>
		</div>
	);
}

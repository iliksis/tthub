import { ClipboardIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

export function ErrorPage({ error }: { error: Error }) {
	const handleCopyDetails = () => {
		const details = [
			`URL: ${window.location.href}`,
			`Time: ${new Date().toISOString()}`,
			`Message: ${error.message}`,
			error.stack ? `Stack:\n${error.stack}` : undefined,
		]
			.filter(Boolean)
			.join("\n");
		navigator.clipboard.writeText(details);
		toast.success(m.common_error_details_copied_to_clipboard());
	};

	return (
		<div className="flex flex-col items-center justify-center gap-2 px-4 mt-10 text-center">
			<div className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<TriangleAlertIcon className="size-7" />
			</div>
			<h1 className="font-bold text-lg">{m.common_an_error_occurred()}</h1>
			<p className="max-w-sm text-muted-foreground text-sm">{error.message}</p>
			<Button className="mt-2" onClick={handleCopyDetails} variant="outline">
				<ClipboardIcon />
				{m.common_copy_error_details()}
			</Button>
			<p className="max-w-sm text-muted-foreground text-xs">
				{m.common_paste_the_details_when_contacting_an_admin_about_this_error()}
			</p>
		</div>
	);
}

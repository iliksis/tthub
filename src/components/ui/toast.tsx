import {
	Toast,
	ToastClose,
	ToastRegion,
	ToastTitle,
	type ToastType,
	toast,
} from "@ui-sdk/react/toast";
import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
	XIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";

function ToastIcon({ type }: { type?: ToastType }) {
	const className = "size-4 shrink-0";
	switch (type) {
		case "success":
			return <CircleCheckIcon aria-hidden="true" className={className} />;
		case "error":
			return <OctagonXIcon aria-hidden="true" className={className} />;
		case "info":
			return <InfoIcon aria-hidden="true" className={className} />;
		case "warning":
			return <TriangleAlertIcon aria-hidden="true" className={className} />;
		case "loading":
			return (
				<Loader2Icon
					aria-hidden="true"
					className={`${className} animate-spin`}
				/>
			);
		default:
			return null;
	}
}

// Stacked at the top edge, newest in front; collapsed toasts peek out 12px.
function Toaster() {
	return (
		<ToastRegion
			side="top"
			align="center"
			className="fixed top-4 left-1/2 z-100 h-(--toast-front-height) w-[min(356px,calc(100vw-2rem))] -translate-x-1/2 data-expanded:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*12px)]"
		>
			{(item) => (
				<Toast className="absolute inset-x-0 top-0 z-[calc(100-var(--toast-index))] flex h-(--toast-height) items-center gap-2 overflow-hidden rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg transition-[translate,scale,opacity,height] duration-300 select-none [--y:calc(var(--toast-index)*12px)] [translate:var(--toast-swipe-x,0px)_calc(var(--y)+var(--toast-swipe-y,0px))] [scale:calc(1-var(--toast-index)*0.05)] not-data-front:not-data-expanded:h-(--toast-front-height) data-ending-style:opacity-0 data-expanded:scale-100 data-expanded:[--y:calc(var(--toast-offset)+var(--toast-index)*12px)] data-starting-style:transition-none data-starting-style:not-data-front:opacity-0 data-starting-style:data-front:[--y:-100%] data-swiping:transition-none motion-reduce:transition-[opacity]">
					<ToastIcon type={item.type} />
					<ToastTitle className="flex-1" />
					<ToastClose
						aria-label={m.common_close()}
						className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
					>
						<XIcon className="size-4" aria-hidden="true" />
					</ToastClose>
				</Toast>
			)}
		</ToastRegion>
	);
}

export { Toaster, ToastIcon, toast };

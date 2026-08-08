import * as React from "react";

const DISMISS_THRESHOLD = 96;

/**
 * Drag-to-dismiss for a sheet's handle: follows the pointer 1:1 while
 * dragging, then either snaps back or dismisses depending on how far past
 * the threshold it was pulled.
 */
export function useDragToDismiss(onDismiss: () => void) {
	const dragStartY = React.useRef<number | null>(null);
	const [dragOffset, setDragOffset] = React.useState(0);
	const [isDragging, setIsDragging] = React.useState(false);

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		dragStartY.current = e.clientY;
		setIsDragging(true);
	};

	const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
		if (dragStartY.current === null) return;
		setDragOffset(Math.max(0, e.clientY - dragStartY.current));
	};

	const onPointerEnd = () => {
		dragStartY.current = null;
		setIsDragging(false);
		if (dragOffset > DISMISS_THRESHOLD) onDismiss();
		setDragOffset(0);
	};

	return {
		dragOffset,
		handlePointerHandlers: {
			onPointerCancel: onPointerEnd,
			onPointerDown,
			onPointerMove,
			onPointerUp: onPointerEnd,
		},
		isDragging,
	};
}

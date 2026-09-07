import type { LabelColor } from "@/api/labels";

type PrioritizedLabel = { priority: number };

/**
 * Among an appointment's attached Labels, returns the one with the highest
 * priority (lowest `priority` value), or undefined if there are none. This is
 * the single place "which Label wins" is decided — both the calendar bar and
 * the iCal feed's COLOR resolve through it.
 */
export function resolveTopPriorityLabel<T extends PrioritizedLabel>(
	labels: T[],
): T | undefined {
	if (labels.length === 0) return undefined;
	return labels.reduce((top, label) =>
		label.priority < top.priority ? label : top,
	);
}

/**
 * Fixed, theme-independent hex per Catppuccin color name (Latte flavor, the
 * palette's canonical/reference accent colors) — used only for the iCal
 * feed's COLOR property, which has no concept of the viewer's light/dark
 * theme. The in-app calendar reuses the existing theme-adaptive
 * getCatppuccinColorStyle instead (see src/lib/utils.ts).
 */
export const catppuccinLatteHex: Record<LabelColor, string> = {
	blue: "#1e66f5",
	flamingo: "#dd7878",
	green: "#40a02b",
	lavender: "#7287fd",
	maroon: "#e64553",
	mauve: "#8839ef",
	peach: "#fe640b",
	pink: "#ea76cb",
	red: "#d20f39",
	rosewater: "#dc8a78",
	sapphire: "#209fb5",
	sky: "#04a5e5",
	teal: "#179299",
	yellow: "#df8e1d",
};

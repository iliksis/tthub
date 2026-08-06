import React from "react";

type ProtoPickerProps = {
	names: string[];
	active: number;
	onChange: (index: number) => void;
};

export function ProtoPicker({ names, active, onChange }: ProtoPickerProps) {
	const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
	const [ready, setReady] = React.useState(false);
	const [highlight, setHighlight] = React.useState({ width: 0, x: 0 });

	const moveHighlight = React.useCallback(() => {
		const el = itemRefs.current[active];
		if (!el) return;
		setHighlight({ width: el.offsetWidth, x: el.offsetLeft });
	}, [active]);

	React.useLayoutEffect(() => {
		moveHighlight();
	}, [moveHighlight]);

	React.useEffect(() => {
		const raf1 = requestAnimationFrame(() =>
			requestAnimationFrame(() => setReady(true)),
		);
		return () => cancelAnimationFrame(raf1);
	}, []);

	React.useEffect(() => {
		window.addEventListener("resize", moveHighlight);
		return () => window.removeEventListener("resize", moveHighlight);
	}, [moveHighlight]);

	React.useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
				target.isContentEditable
			)
				return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const num = Number.parseInt(e.key, 10);
			if (num >= 1 && num <= names.length) onChange(num - 1);
			else if (e.key === "ArrowRight") onChange((active + 1) % names.length);
			else if (e.key === "ArrowLeft")
				onChange((active - 1 + names.length) % names.length);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [active, names.length, onChange]);

	return (
		<nav
			className="proto-picker"
			aria-label="Prototype variants"
			data-ready={ready ? "" : undefined}
			style={{
				alignItems: "center",
				backdropFilter: "blur(12px) saturate(1.4)",
				background: "rgba(10, 10, 10, 0.82)",
				borderRadius: 999,
				bottom: 24,
				boxShadow:
					"0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 8px 24px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.12)",
				display: "flex",
				fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
				fontSize: 13,
				gap: 2,
				left: "50%",
				lineHeight: 1,
				padding: 4,
				position: "fixed",
				transform: "translateX(-50%)",
				userSelect: "none",
				zIndex: 2147483647,
			}}
		>
			<span
				aria-hidden="true"
				style={{
					background: "rgba(255, 255, 255, 0.12)",
					borderRadius: 999,
					height: 28,
					left: 0,
					position: "absolute",
					top: 4,
					transform: `translateX(${highlight.x}px)`,
					transition: ready
						? "transform 250ms cubic-bezier(0.23, 1, 0.32, 1), width 250ms cubic-bezier(0.23, 1, 0.32, 1)"
						: undefined,
					width: highlight.width,
				}}
			/>
			{names.map((name, i) => (
				<button
					key={name}
					type="button"
					ref={(el) => {
						itemRefs.current[i] = el;
					}}
					data-active={i === active ? "" : undefined}
					aria-current={i === active ? "true" : undefined}
					onClick={() => onChange(i)}
					style={{
						alignItems: "center",
						background: "transparent",
						border: 0,
						borderRadius: 999,
						color: i === active ? "#fff" : "rgba(255, 255, 255, 0.55)",
						cursor: "pointer",
						display: "flex",
						font: "inherit",
						height: 28,
						padding: "0 12px",
						position: "relative",
						transition: "color 150ms ease-out",
					}}
				>
					{name}
				</button>
			))}
		</nav>
	);
}

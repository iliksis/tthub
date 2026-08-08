import {
	CalendarDaysIcon,
	CheckIcon,
	MapPinIcon,
	PartyPopperIcon,
	XIcon,
} from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useRef,
	useState,
} from "react";
import type { Appointment, Response } from "@/lib/prisma/client";
import type { ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Link } from "../ui/link";

const SWIPE_THRESHOLD = 90;
const MAX_VISIBLE = 3;

type PendingAppointment = Appointment & { responses?: Response[] };

type PendingPileProps = {
	appointments: PendingAppointment[];
	onRespond: (appointmentId: string, response: ResponseType) => void;
};

export const PendingPile = ({ appointments, onRespond }: PendingPileProps) => {
	if (appointments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-card py-10 text-center">
				<PartyPopperIcon className="size-6 text-success" />
				<div className="font-medium text-muted-foreground text-sm">
					{t("You responded to all appointments")}
				</div>
			</div>
		);
	}

	const visible = appointments.slice(0, MAX_VISIBLE);

	return (
		<div className="flex flex-col gap-3">
			<div className="relative" style={{ height: 152 }}>
				{visible
					.map((appointment, i) => (
						<PileCard
							key={appointment.id}
							appointment={appointment}
							depth={i}
							onRespond={
								i === 0
									? (response) => onRespond(appointment.id, response)
									: undefined
							}
						/>
					))
					.reverse()}
			</div>
			<div className="text-center text-muted-foreground text-xs">
				{t("Swipe to respond")}
			</div>
		</div>
	);
};

type PileCardProps = {
	appointment: PendingAppointment;
	depth: number;
	onRespond?: (response: ResponseType) => void;
};

const PileCard = ({ appointment, depth, onRespond }: PileCardProps) => {
	const [dragX, setDragX] = useState(0);
	const [dragging, setDragging] = useState(false);
	const startX = useRef(0);
	const cardRef = useRef<HTMLDivElement>(null);
	const [exiting, setExiting] = useState<"left" | "right" | null>(null);

	const isTop = depth === 0;

	const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!isTop) return;
		startX.current = e.clientX;
		setDragging(true);
		cardRef.current?.setPointerCapture(e.pointerId);
	};

	const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragging) return;
		setDragX(e.clientX - startX.current);
	};

	const settle = () => {
		setDragging(false);
		if (dragX > SWIPE_THRESHOLD) {
			setExiting("right");
			window.setTimeout(() => onRespond?.("ACCEPT"), 180);
		} else if (dragX < -SWIPE_THRESHOLD) {
			setExiting("left");
			window.setTimeout(() => onRespond?.("DECLINE"), 180);
		} else {
			setDragX(0);
		}
	};

	const acceptStrength = Math.min(Math.max(dragX, 0) / SWIPE_THRESHOLD, 1);
	const declineStrength = Math.min(Math.max(-dragX, 0) / SWIPE_THRESHOLD, 1);

	const exitTransform =
		exiting === "right"
			? "translateX(420px) rotate(18deg)"
			: exiting === "left"
				? "translateX(-420px) rotate(-18deg)"
				: undefined;

	return (
		<div
			ref={cardRef}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={settle}
			onPointerCancel={settle}
			className={cn(
				"absolute inset-x-0 top-0 touch-pan-y select-none rounded-xl border p-4 shadow-sm",
				isTop ? "border-border/60 bg-card" : "border-border bg-muted",
				!dragging && "transition-all duration-200 ease-out",
				isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
			)}
			style={{
				opacity: exiting ? 0 : 1 - depth * 0.06,
				transform:
					exitTransform ??
					`translateY(${depth * 14}px) scale(${1 - depth * 0.05}) translateX(${dragX}px) rotate(${dragX / 24}deg)`,
				zIndex: MAX_VISIBLE - depth,
			}}
		>
			{isTop && (
				<div className="pointer-events-none absolute inset-0">
					<div
						className="absolute inset-0 flex items-center justify-center transition-opacity"
						style={{ opacity: declineStrength }}
					>
						<div
							className="flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 font-extrabold text-lg text-white uppercase tracking-wide shadow-lg"
							style={{
								transform: `scale(${0.8 + declineStrength * 0.2}) rotate(-6deg)`,
							}}
						>
							<XIcon className="size-6" /> {t("Decline")}
						</div>
					</div>
					<div
						className="absolute inset-0 flex items-center justify-center transition-opacity"
						style={{ opacity: acceptStrength }}
					>
						<div
							className="flex items-center gap-2 rounded-xl bg-success px-4 py-2 font-extrabold text-lg text-success-foreground uppercase tracking-wide shadow-lg"
							style={{
								transform: `scale(${0.8 + acceptStrength * 0.2}) rotate(6deg)`,
							}}
						>
							<CheckIcon className="size-6" /> {t("Accept")}
						</div>
					</div>
				</div>
			)}
			<div className="mb-1 font-bold text-xs uppercase tracking-wide">
				{new Date(appointment.startDate).toLocaleDateString("de-DE", {
					weekday: "long",
				})}
			</div>
			<h3 className="mb-2 font-bold text-lg leading-tight">
				<Link to={`/appts/$apptId`} params={{ apptId: appointment.id }}>
					{appointment.title}
				</Link>
			</h3>
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-sm">
				<span className="flex items-center gap-1.5">
					<CalendarDaysIcon className="size-3.5" />
					{new Date(appointment.startDate).toLocaleTimeString("de-DE", {
						timeStyle: "short",
					})}
				</span>
				{appointment.location && (
					<span className="flex items-center gap-1.5">
						<MapPinIcon className="size-3.5" />
						{appointment.location}
					</span>
				)}
			</div>
		</div>
	);
};

import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Link } from "@/components/ui/link";

type AppointmentRowProps = {
	appointmentId: string;
	title: string;
	date: Date | string;
	dateLabel?: string;
	time?: string;
	icon?: LucideIcon;
	secondary?: string;
	location?: string | null;
	badge?: {
		label: string;
		variant: VariantProps<typeof badgeVariants>["variant"];
	};
};

const fmtDay = (date: Date | string) =>
	new Date(date).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "short",
	});

export function AppointmentRow({
	appointmentId,
	title,
	date,
	dateLabel,
	time,
	icon: Icon,
	secondary,
	location,
	badge,
}: AppointmentRowProps) {
	return (
		<Link
			to="/appts/$apptId"
			params={{ apptId: appointmentId }}
			className="flex items-center gap-2.5 border-border/60 border-b py-2 text-foreground text-sm no-underline last:border-b-0 hover:bg-muted/50 hover:no-underline"
		>
			{Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
			<span className="w-16 shrink-0 text-muted-foreground text-xs tabular-nums">
				{dateLabel ?? fmtDay(date)}
			</span>
			{time && (
				<span className="hidden w-10 shrink-0 text-muted-foreground text-xs tabular-nums sm:inline">
					{time}
				</span>
			)}
			<span className="min-w-0 flex-1 truncate text-primary">{title}</span>
			{secondary && (
				<span className="hidden shrink-0 text-muted-foreground text-xs sm:inline">
					{secondary}
				</span>
			)}
			{badge ? (
				<Badge variant={badge.variant} className="h-4.5 shrink-0 px-1.5">
					{badge.label}
				</Badge>
			) : (
				location && (
					<span className="hidden shrink-0 truncate text-muted-foreground text-xs sm:inline">
						{location}
					</span>
				)
			)}
		</Link>
	);
}

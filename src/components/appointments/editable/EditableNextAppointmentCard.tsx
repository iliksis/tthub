import { PencilIcon, XIcon } from "lucide-react";
import { InternalLink } from "@/components/InternalLink";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Appointment } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { useInlineEditable } from "./useInlineEditable";

type EditableNextAppointmentCardProps = {
	appointmentId: string;
	nextAppointmentId: string | null;
	nextAppointment: { id: string; title: string } | null;
	otherAppointments: Appointment[];
	canEdit: boolean;
	onSave: (nextAppointmentId: string) => Promise<boolean>;
};

/** Lightweight "Next Appointment: …" row — no card chrome, sits inline in the main content. */
export function EditableNextAppointmentCard({
	appointmentId,
	nextAppointmentId,
	nextAppointment,
	otherAppointments,
	canEdit,
	onSave,
}: EditableNextAppointmentCardProps) {
	const { editing, start, cancel, commit } = useInlineEditable<string | null>({
		canEdit,
		onSave: (v) => onSave(v ?? ""),
		value: nextAppointmentId,
	});

	if (editing) {
		return (
			<div className="flex items-center gap-2 border-border/60 border-t pt-4 text-sm">
				<span className="shrink-0 text-muted-foreground">
					{t("Next Appointment")}:
				</span>
				<Select
					value={nextAppointmentId ?? undefined}
					onValueChange={(v) => commit(v)}
				>
					<SelectTrigger autoFocus className="w-full">
						<SelectValue placeholder={t("Choose an appointment")} />
					</SelectTrigger>
					<SelectContent>
						{otherAppointments.map((o) => (
							<SelectItem
								key={o.id}
								value={o.id}
								disabled={o.id === appointmentId}
								className="before:content-[attr(data-before)] before:opacity-60"
								data-before={new Date(o.startDate).toLocaleDateString("de-DE", {
									day: "2-digit",
									month: "2-digit",
									year: "2-digit",
								})}
							>
								{o.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label={t("Cancel")}
					onClick={cancel}
				>
					<XIcon className="size-3.5" />
				</Button>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 border-border/60 border-t pt-4 text-sm">
			<span className="text-muted-foreground">{t("Next Appointment")}:</span>
			{nextAppointment ? (
				<InternalLink
					to="/appts/$apptId"
					params={{ apptId: nextAppointment.id }}
					className="text-primary"
				>
					{nextAppointment.title} →
				</InternalLink>
			) : (
				<span className="text-muted-foreground">{t("No appointment set")}</span>
			)}
			{canEdit && (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground"
					aria-label={t("Edit")}
					onClick={start}
				>
					<PencilIcon className="size-3.5" />
				</Button>
			)}
		</div>
	);
}

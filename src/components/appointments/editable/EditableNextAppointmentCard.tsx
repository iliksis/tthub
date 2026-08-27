import { PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Appointment } from "@/lib/prisma/client";
import { m } from "@/paraglide/messages";
import { useInlineEditable } from "./useInlineEditable";

type EditableNextAppointmentCardProps = {
	appointmentId: string;
	nextAppointmentId: string | null;
	nextAppointment: { id: string; title: string } | null;
	otherAppointments: Appointment[];
	canEdit: boolean;
	onSave: (nextAppointmentId: string | null) => Promise<boolean>;
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
		onSave,
		value: nextAppointmentId,
	});

	if (editing) {
		return (
			<div>
				<div className="mb-1 text-muted-foreground text-xs uppercase">
					{m.appointments_next_appointment()}:
				</div>
				<Select
					value={nextAppointmentId ?? undefined}
					onValueChange={(v) => commit(v)}
				>
					<SelectTrigger autoFocus className="w-full">
						<SelectValue placeholder={m.appointments_choose_an_appointment()} />
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
					aria-label={m.appointments_cancel()}
					onClick={cancel}
				>
					<XIcon className="size-3.5" />
				</Button>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-1 text-muted-foreground text-xs uppercase">
				{m.appointments_next_appointment()}:
			</div>
			{nextAppointment ? (
				<Link to="/appts/$apptId" params={{ apptId: nextAppointment.id }}>
					{nextAppointment.title}
				</Link>
			) : (
				<span className="text-muted-foreground">
					{m.appointments_no_appointment_set()}
				</span>
			)}
			{canEdit && (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground"
					aria-label={m.appointments_edit()}
					onClick={start}
				>
					<PencilIcon className="size-3.5" />
				</Button>
			)}
		</div>
	);
}

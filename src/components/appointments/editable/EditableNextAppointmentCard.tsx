import { InternalLink } from "@/components/InternalLink";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Appointment } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { EditableCardChrome } from "./EditableCardChrome";
import { useInlineEditable } from "./useInlineEditable";

type EditableNextAppointmentCardProps = {
	appointmentId: string;
	nextAppointmentId: string | null;
	nextAppointment: { id: string; title: string } | null;
	otherAppointments: Appointment[];
	gridRows?: 1 | 2 | 3 | 4;
	canEdit: boolean;
	onSave: (nextAppointmentId: string) => Promise<boolean>;
};

export function EditableNextAppointmentCard({
	appointmentId,
	nextAppointmentId,
	nextAppointment,
	otherAppointments,
	gridRows = 4,
	canEdit,
	onSave,
}: EditableNextAppointmentCardProps) {
	const { editing, isSaving, start, cancel, commit } = useInlineEditable<
		string | null
	>({
		canEdit,
		onSave: (v) => onSave(v ?? ""),
		value: nextAppointmentId,
	});

	return (
		<EditableCardChrome
			title={t("Next Appointment")}
			gridRows={gridRows}
			canEdit={canEdit}
			editing={editing}
			isSaving={isSaving}
			autoCommitting
			onStartEdit={start}
			onCommit={commit}
			onCancel={cancel}
			renderRead={() =>
				nextAppointment ? (
					<InternalLink
						to="/appts/$apptId"
						params={{ apptId: nextAppointment.id }}
					>
						{nextAppointment.title}
					</InternalLink>
				) : (
					t("No appointment set")
				)
			}
			renderEdit={() => (
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
			)}
		/>
	);
}

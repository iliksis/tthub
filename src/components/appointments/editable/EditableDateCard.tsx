import { Input } from "@/components/ui/input";
import { t } from "@/lib/text";
import { dateToInputValue } from "@/lib/utils";
import { EditableCardChrome } from "./EditableCardChrome";
import { useInlineEditable } from "./useInlineEditable";

type DateValue = { startDate: Date; endDate: Date | null };

type EditableDateCardProps = {
	startDate: Date;
	endDate: Date | null;
	isMultipleDays: boolean;
	gridRows?: 1 | 2 | 3 | 4;
	canEdit: boolean;
	onSave: (value: DateValue) => Promise<boolean>;
};

export function EditableDateCard({
	startDate,
	endDate,
	isMultipleDays,
	gridRows = 4,
	canEdit,
	onSave,
}: EditableDateCardProps) {
	const { draft, setDraft, editing, isSaving, start, cancel, commit } =
		useInlineEditable<DateValue>({
			canEdit,
			onSave,
			value: { endDate, startDate },
		});

	return (
		<EditableCardChrome
			title={t("Date & Time")}
			gridRows={gridRows}
			canEdit={canEdit}
			editing={editing}
			isSaving={isSaving}
			onStartEdit={start}
			onCommit={commit}
			onCancel={cancel}
			renderRead={() => (
				<p>
					{startDate.toLocaleDateString("de-DE", {
						day: "2-digit",
						month: "short",
						year: "numeric",
					})}
					{isMultipleDays && endDate && (
						<>
							{" "}
							-{" "}
							{endDate.toLocaleDateString("de-DE", {
								day: "2-digit",
								month: "short",
								year: "numeric",
							})}
						</>
					)}
					{" · "}
					{startDate.toLocaleTimeString("de-DE", { timeStyle: "short" })}
				</p>
			)}
			renderEdit={() => (
				<>
					<Input
						autoFocus
						type="datetime-local"
						value={dateToInputValue(draft.startDate)}
						onChange={(e) =>
							setDraft({ ...draft, startDate: new Date(e.target.value) })
						}
					/>
					<Input
						type="date"
						value={draft.endDate ? dateToInputValue(draft.endDate, false) : ""}
						onChange={(e) =>
							setDraft({
								...draft,
								endDate: e.target.value ? new Date(e.target.value) : null,
							})
						}
					/>
				</>
			)}
		/>
	);
}

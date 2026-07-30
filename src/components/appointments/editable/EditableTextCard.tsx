import { Input } from "@/components/ui/input";
import { EditableCardChrome } from "./EditableCardChrome";
import { useInlineEditable } from "./useInlineEditable";

type EditableTextCardProps = {
	title: string;
	value: string;
	displayValue?: React.ReactNode;
	placeholder: string;
	gridRows?: 1 | 2 | 3 | 4;
	canEdit: boolean;
	onSave: (value: string) => Promise<boolean>;
};

export function EditableTextCard({
	title,
	value,
	displayValue,
	placeholder,
	gridRows = 2,
	canEdit,
	onSave,
}: EditableTextCardProps) {
	const { draft, setDraft, editing, isSaving, start, cancel, commit } =
		useInlineEditable<string>({ canEdit, onSave, value });

	return (
		<EditableCardChrome
			title={title}
			gridRows={gridRows}
			canEdit={canEdit}
			editing={editing}
			isSaving={isSaving}
			onStartEdit={start}
			onCommit={commit}
			onCancel={cancel}
			renderRead={() => displayValue ?? <p>{value || placeholder}</p>}
			renderEdit={() => (
				<Input
					autoFocus
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
				/>
			)}
		/>
	);
}

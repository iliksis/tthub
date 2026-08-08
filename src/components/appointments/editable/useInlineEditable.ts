import * as React from "react";

type UseInlineEditableOptions<T> = {
	value: T;
	canEdit: boolean;
	onSave: (draft: T) => Promise<boolean>;
};

export function useInlineEditable<T>({
	value,
	canEdit,
	onSave,
}: UseInlineEditableOptions<T>) {
	const [editing, setEditing] = React.useState(false);
	const [draft, setDraft] = React.useState(value);
	const [isSaving, setIsSaving] = React.useState(false);

	const start = () => {
		if (!canEdit) return;
		setDraft(value);
		setEditing(true);
	};

	const cancel = () => {
		setDraft(value);
		setEditing(false);
	};

	const commit = async (overrideDraft?: T) => {
		setIsSaving(true);
		try {
			const ok = await onSave(overrideDraft ?? draft);
			if (ok) setEditing(false);
		} finally {
			setIsSaving(false);
		}
	};

	return { cancel, commit, draft, editing, isSaving, setDraft, start };
}

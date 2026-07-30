import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useInlineEditable } from "./useInlineEditable";

type HeaderValue = { title: string; shortTitle: string };

type EditableHeaderProps = {
	title: string;
	shortTitle: string;
	canEdit: boolean;
	onSave: (value: HeaderValue) => Promise<boolean>;
	className?: string;
};

export function EditableHeader({
	title,
	shortTitle,
	canEdit,
	onSave,
	className,
}: EditableHeaderProps) {
	const { draft, setDraft, editing, isSaving, start, cancel, commit } =
		useInlineEditable<HeaderValue>({
			canEdit,
			onSave,
			value: { shortTitle, title },
		});

	const onInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			commit();
		}
		if (e.key === "Escape") cancel();
	};

	if (editing) {
		return (
			<div
				className={cn(
					"flex flex-col gap-1.5 rounded-md p-1 ring-1 ring-ring",
					className,
				)}
			>
				<Input
					autoFocus
					value={draft.title}
					onChange={(e) => setDraft({ ...draft, title: e.target.value })}
					onKeyDown={onInputKeyDown}
					className="font-bold text-xl"
				/>
				<div className="flex items-center gap-2">
					<Input
						value={draft.shortTitle}
						onChange={(e) => setDraft({ ...draft, shortTitle: e.target.value })}
						onKeyDown={onInputKeyDown}
						className="text-sm"
					/>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label={t("Save")}
						disabled={isSaving}
						onClick={() => commit()}
					>
						<CheckIcon className="size-3.5" />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label={t("Cancel")}
						disabled={isSaving}
						onClick={cancel}
					>
						<XIcon className="size-3.5" />
					</Button>
				</div>
			</div>
		);
	}

	if (!canEdit) {
		return (
			<div className={cn("p-1", className)}>
				<h1 className="font-bold text-xl">{title}</h1>
				<p className="text-muted-foreground text-sm">{shortTitle}</p>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={start}
			className={cn(
				"group block w-full rounded-md p-1 text-left hover:bg-accent/50",
				className,
			)}
		>
			<span className="flex items-center gap-2">
				<h1 className="font-bold text-xl">{title}</h1>
				<PencilIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
			</span>
			<p className="text-muted-foreground text-sm">{shortTitle}</p>
		</button>
	);
}

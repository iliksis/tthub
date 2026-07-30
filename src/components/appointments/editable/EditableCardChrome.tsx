import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/text";
import { cn } from "@/lib/utils";

const spanClass = {
	1: "col-span-1",
	2: "col-span-2",
	3: "col-span-3",
	4: "col-span-4",
} as const;

type EditableCardChromeProps = {
	title: string;
	gridRows?: 1 | 2 | 3 | 4;
	canEdit: boolean;
	editing: boolean;
	isSaving?: boolean;
	/** True for fields that commit as soon as a value is picked (e.g. a Select) — hides the Save button and disables Enter-to-commit. */
	autoCommitting?: boolean;
	onStartEdit: () => void;
	onCommit: () => void;
	onCancel: () => void;
	renderRead: () => React.ReactNode;
	renderEdit: () => React.ReactNode;
};

export function EditableCardChrome({
	title,
	gridRows = 1,
	canEdit,
	editing,
	isSaving,
	autoCommitting,
	onStartEdit,
	onCommit,
	onCancel,
	renderRead,
	renderEdit,
}: EditableCardChromeProps) {
	if (editing) {
		return (
			<Card className={cn("py-4 ring-1 ring-ring", spanClass[gridRows])}>
				<CardContent
					className="flex flex-col gap-2 px-4"
					onKeyDown={(e) => {
						if (!autoCommitting && e.key === "Enter") {
							e.preventDefault();
							onCommit();
						}
						if (e.key === "Escape") onCancel();
					}}
				>
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">{title}</CardTitle>
						<div className="flex gap-1">
							{!autoCommitting && (
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={t("Save")}
									disabled={isSaving}
									onClick={() => onCommit()}
								>
									<CheckIcon className="size-3.5" />
								</Button>
							)}
							<Button
								size="icon-xs"
								variant="ghost"
								aria-label={t("Cancel")}
								disabled={isSaving}
								onClick={onCancel}
							>
								<XIcon className="size-3.5" />
							</Button>
						</div>
					</div>
					{renderEdit()}
				</CardContent>
			</Card>
		);
	}

	if (!canEdit) {
		return (
			<Card className={cn("py-4", spanClass[gridRows])}>
				<CardContent className="flex flex-col gap-2 px-4">
					<CardTitle className="text-base">{title}</CardTitle>
					{renderRead()}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card
			className={cn(
				"group cursor-pointer py-4 transition-shadow hover:ring-1 hover:ring-ring/40",
				spanClass[gridRows],
			)}
			role="button"
			tabIndex={0}
			onClick={onStartEdit}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onStartEdit();
				}
			}}
		>
			<CardContent className="flex flex-col gap-2 px-4">
				<CardTitle className="flex items-center justify-between text-base">
					{title}
					<PencilIcon className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
				</CardTitle>
				{renderRead()}
			</CardContent>
		</Card>
	);
}

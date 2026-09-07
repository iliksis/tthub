import { PlusIcon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { createLabel, type LabelColor } from "@/api/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/hooks/useMutation";
import type { Label as LabelRecord } from "@/lib/prisma/client";
import { cn, getCatppuccinColorStyle } from "@/lib/utils";
import { m } from "@/paraglide/messages";

// New labels quick-created from this picker all get this fixed swatch — the
// full color choice only matters on the /settings/labels management page,
// where an editor can rename/recolor afterwards.
const QUICK_CREATE_COLOR: LabelColor = "blue";

type LabelMultiSelectProps = {
	availableLabels: LabelRecord[];
	selectedIds: string[];
	onChange: (labels: LabelRecord[]) => void;
	/** Quick-create calls the EDITOR/ADMIN-only createLabel endpoint — hide it
	 * for pickers a plain USER can reach (e.g. notification muting). */
	allowCreate?: boolean;
};

export function LabelMultiSelect({
	availableLabels,
	selectedIds,
	onChange,
	allowCreate = true,
}: LabelMultiSelectProps) {
	const [query, setQuery] = React.useState("");
	const [knownLabels, setKnownLabels] = React.useState(availableLabels);
	React.useEffect(() => setKnownLabels(availableLabels), [availableLabels]);

	// Read inside onCreate's async continuation instead of the `selected` value
	// closed over at click time — otherwise a selection made while the create
	// request is still in flight would be silently overwritten once it resolves.
	const selectedIdsRef = React.useRef(selectedIds);
	React.useEffect(() => {
		selectedIdsRef.current = selectedIds;
	}, [selectedIds]);

	const createMutation = useMutation({
		fn: createLabel,
		onError: (err) => {
			toast.error(err.message);
		},
	});

	const selected = knownLabels.filter((l) => selectedIds.includes(l.id));
	const trimmedQuery = query.trim();
	const filtered = knownLabels.filter(
		(l) =>
			!selectedIds.includes(l.id) &&
			l.name.toLowerCase().includes(trimmedQuery.toLowerCase()),
	);
	const hasExactMatch = knownLabels.some(
		(l) => l.name.toLowerCase() === trimmedQuery.toLowerCase(),
	);
	const canCreate = allowCreate && trimmedQuery.length > 0 && !hasExactMatch;

	const select = (label: LabelRecord) => {
		onChange([...selected, label]);
		setQuery("");
	};
	const remove = (id: string) => {
		onChange(selected.filter((l) => l.id !== id));
	};

	const onCreate = async () => {
		if (!trimmedQuery) return;
		const res = await createMutation.mutate({
			data: {
				color: QUICK_CREATE_COLOR,
				countsForStats: false,
				name: trimmedQuery,
			},
		});
		if (!res) return;
		const created = res.data;
		setKnownLabels((prev) => [...prev, created]);
		const currentSelected = knownLabels.filter((l) =>
			selectedIdsRef.current.includes(l.id),
		);
		onChange([...currentSelected, created]);
		setQuery("");
	};

	return (
		<div className="flex flex-col gap-2">
			{selected.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{selected.map((label) => {
						const style = getCatppuccinColorStyle(label.color as LabelColor);
						return (
							<span
								key={label.id}
								className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary-foreground"
								style={{
									backgroundColor: style.backgroundColor,
								}}
							>
								{label.name}
								<button
									type="button"
									aria-label={m.labels_remove_label()}
									onClick={() => remove(label.id)}
									className="opacity-70 hover:opacity-100"
								>
									<XIcon className="size-3" />
								</button>
							</span>
						);
					})}
				</div>
			)}
			<Input
				placeholder={
					allowCreate
						? m.labels_search_or_create_label()
						: m.labels_search_label()
				}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>
			{trimmedQuery.length > 0 && (filtered.length > 0 || canCreate) && (
				<div className="flex flex-wrap gap-1.5">
					{filtered.map((label) => (
						<button
							key={label.id}
							type="button"
							onClick={() => select(label)}
							className={cn(
								"rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
								"hover:bg-muted hover:text-foreground",
							)}
						>
							{label.name}
						</button>
					))}
					{canCreate && (
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={createMutation.status === "pending"}
							onClick={onCreate}
						>
							<PlusIcon className="size-3.5" />
							{m.labels_create_label_named({ param1: trimmedQuery })}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

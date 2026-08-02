import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Response, User } from "@/lib/prisma/client";
import { ResponseType } from "@/lib/prisma/enums";
import { t } from "@/lib/text";
import { cn, createColorForUserId, shortenUserName } from "@/lib/utils";

const responseBadgeVariant: Record<
	string,
	"success" | "warning" | "destructive"
> = {
	[ResponseType.ACCEPT]: "success",
	[ResponseType.DECLINE]: "destructive",
	[ResponseType.MAYBE]: "warning",
};

const responseBadgeLabel: Record<string, string> = {
	[ResponseType.ACCEPT]: t("Accept"),
	[ResponseType.DECLINE]: t("Decline"),
	[ResponseType.MAYBE]: t("Maybe"),
};

type ResponsesPanelProps = {
	responses: (Response & { user: User })[];
	currentUserId?: string;
	isDeleted: boolean;
	onResponse: (response: ResponseType) => () => Promise<void>;
	/** Hide the Accept/Maybe/Decline buttons when they're shown elsewhere (e.g. a mobile action dock) — the named list still renders. */
	showActions?: boolean;
};

/** Named list with Accept/Decline badges — Maybe responses are counted but not listed by name. */
export function ResponsesPanel({
	responses,
	currentUserId,
	isDeleted,
	onResponse,
	showActions = true,
}: ResponsesPanelProps) {
	const myResponse = responses.find((r) => r.userId === currentUserId);
	const isAccepted = myResponse?.responseType === ResponseType.ACCEPT;
	const isMaybe = myResponse?.responseType === ResponseType.MAYBE;
	const isDeclined = myResponse?.responseType === ResponseType.DECLINE;
	const visible = responses.filter(
		(r) => r.responseType !== ResponseType.MAYBE,
	);

	return (
		<div className="rounded-lg bg-card p-4">
			<div className="mb-3 flex items-center justify-between">
				<span className="font-bold text-sm">{t("Responses")}</span>
			</div>

			{showActions && (
				<div className="mb-4 grid grid-cols-3 gap-2">
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"w-auto border border-success/30 text-success hover:bg-success/15 hover:text-success",
							isAccepted &&
								"border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.ACCEPT)}
					>
						{isAccepted ? t("Accepted") : t("Accept")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning",
							isMaybe &&
								"border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.MAYBE)}
					>
						{t("Maybe")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
							isDeclined &&
								"border-destructive bg-destructive text-white hover:bg-destructive/90",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.DECLINE)}
					>
						{isDeclined ? t("Declined") : t("Decline")}
					</Button>
				</div>
			)}

			<ul className="flex flex-col gap-2 border-border/60 border-t pt-3">
				{visible.map((r) => {
					const userColor = createColorForUserId(r.userId);
					return (
						<li key={r.userId} className="flex items-center gap-2 text-sm">
							<Avatar size="sm">
								<AvatarFallback
									style={{
										backgroundColor: userColor.backgroundColor,
										color: userColor.foregroundColor,
									}}
								>
									{shortenUserName(r.user.name)}
								</AvatarFallback>
							</Avatar>
							<span className="flex-1">{r.user.name}</span>
							<Badge variant={responseBadgeVariant[r.responseType]}>
								{responseBadgeLabel[r.responseType]}
							</Badge>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

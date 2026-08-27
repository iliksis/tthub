import { Section } from "@/components/Section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Response, User } from "@/lib/prisma/client";
import { ResponseType } from "@/lib/prisma/enums";
import { cn, createColorForUserId, shortenUserName } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const responseBadgeVariant: Record<
	string,
	"success" | "warning" | "destructive"
> = {
	[ResponseType.ACCEPT]: "success",
	[ResponseType.DECLINE]: "destructive",
	[ResponseType.MAYBE]: "warning",
};

const responseBadgeLabel: Record<string, string> = {
	[ResponseType.ACCEPT]: m.common_accept(),
	[ResponseType.DECLINE]: m.common_decline(),
	[ResponseType.MAYBE]: m.common_maybe(),
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
	const isMaybe =
		!myResponse || myResponse?.responseType === ResponseType.MAYBE;
	const isDeclined = myResponse?.responseType === ResponseType.DECLINE;
	const visible = responses.filter(
		(r) => r.responseType !== ResponseType.MAYBE,
	);

	return (
		<Section title={m.appointments_responses()}>
			{showActions && (
				<div className="mb-4 grid grid-cols-3 gap-2">
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"w-auto border border-success/30 text-success hover:bg-success/15 hover:text-success",
							isAccepted &&
								"border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground dark:hover:text-success",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.ACCEPT)}
					>
						{isAccepted ? m.common_accepted() : m.common_accept()}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border border-warning/30 text-warning hover:bg-warning/15 hover:text-warning",
							isMaybe &&
								"border-warning bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground dark:hover:text-warning",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.MAYBE)}
					>
						{m.common_maybe()}
					</Button>
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"border border-destructive/30 text-destructive hover:bg-destructive/15 hover:text-destructive",
							isDeclined &&
								"border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground dark:hover:text-destructive",
						)}
						disabled={isDeleted}
						onClick={onResponse(ResponseType.DECLINE)}
					>
						{isDeclined ? m.common_declined() : m.common_decline()}
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
		</Section>
	);
}

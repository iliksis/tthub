import {
	createFileRoute,
	Link,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createResponse, getAppointments } from "@/api/appointments";
import {
	Filters,
	filterSchema,
	getAppointmentColumns,
	InlineFilters,
	List,
} from "@/components/appointments/List";
import { DetailsList } from "@/components/DetailsList";
import { Button } from "@/components/ui/button";
import { TableRow } from "@/components/ui/table";
import type { Appointment, Response } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { cn, isDayInPast } from "@/lib/utils";

// biome-ignore assist/source/useSortedKeys: validateSearch and loaderDeps need to be before loader
export const Route = createFileRoute("/_authed/appts/")({
	component: RouteComponent,
	validateSearch: filterSchema,
	loaderDeps: ({ search }) => ({ ...search }),
	loader: async ({ deps: { deleted, title, location } }) => {
		const data = await getAppointments({
			data: {
				location,
				orderBy: { startDate: "desc" },
				title,
				withDeleted: deleted,
			},
		});
		const response = await data.json();
		if (data.status < 400) {
			return { appointments: response.data };
		}
		throw new Error(response.message);
	},
	head: () => ({
		meta: [{ title: t("Appointments") }],
	}),
});

function RouteComponent() {
	const { appointments } = Route.useLoaderData();
	const search = Route.useSearch();
	const { user } = useRouteContext({ from: "__root__" });
	const canEdit = user?.role === "EDITOR" || user?.role === "ADMIN";

	if (!appointments) return <div>{t("An Error occurred")}</div>;

	return (
		<>
			{/* Mobile / tablet layout */}
			<div className="lg:hidden">
				<Filters {...search} />
				<List appointments={appointments} />
			</div>

			{/* Desktop layout: master-detail + inline filters */}
			<div className="hidden lg:flex lg:flex-col lg:gap-4">
				<div className="flex items-center gap-3">
					<h1 className="font-bold text-lg flex-1">{t("Appointments")}</h1>
					<div className="flex overflow-hidden rounded-md border text-sm">
						<span className="bg-primary px-3 py-1.5 font-medium text-primary-foreground">
							{t("List")}
						</span>
						<Link
							to="/appts/calendar"
							className="px-3 py-1.5 text-muted-foreground hover:bg-accent"
						>
							{t("Calendar")}
						</Link>
					</div>
					{canEdit && (
						<Button asChild>
							<Link to="/create">
								<CalendarPlusIcon className="size-4" />
								{t("Create appointment")}
							</Link>
						</Button>
					)}
				</div>
				<div className="rounded-lg bg-card p-3">
					<InlineFilters {...search} />
				</div>
				<AppointmentSplitView appointments={appointments} />
			</div>
		</>
	);
}

type AppointmentWithResponses = Appointment & { responses: Response[] };

const AppointmentSplitView = ({
	appointments,
}: {
	appointments: AppointmentWithResponses[];
}) => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();
	const createResponseServerFn = useServerFn(createResponse);
	const [selectedId, setSelectedId] = React.useState<string | undefined>(
		appointments[0]?.id,
	);

	const selected = appointments.find((a) => a.id === selectedId);

	const onAccept = async () => {
		if (!selected) return;
		const res = await createResponseServerFn({
			data: { appointmentId: selected.id, response: "ACCEPT" },
		});
		const data = await res.json();
		if (res.status < 400 && data) {
			await router.invalidate();
			return;
		}
		toast.error(data.message);
	};

	if (appointments.length === 0) {
		return (
			<div className="rounded-lg bg-card p-8 text-center text-muted-foreground">
				{t("No appointments found")}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-[1fr_360px] gap-4">
			<div className="min-w-0 overflow-x-auto rounded-lg bg-card">
				<DetailsList
					items={appointments}
					getItemId={(item) => item.id}
					columns={getAppointmentColumns(user?.id)}
					onRenderRow={(item, children) => {
						const inPast = isDayInPast(item.startDate);
						const isDeleted = item.deletedAt !== null;
						return (
							<TableRow
								key={item.id}
								className={cn(
									"h-10 cursor-pointer",
									item.id === selectedId && "bg-muted",
									inPast && "opacity-65",
									isDeleted && "text-destructive",
								)}
								onClick={() => setSelectedId(item.id)}
							>
								{children}
							</TableRow>
						);
					}}
					selectMode="none"
				/>
			</div>
			<div className="min-w-0 rounded-lg bg-card p-5">
				{selected ? (
					<>
						<div className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
							{t("Selected")}
						</div>
						<h3 className="mb-4 font-bold text-lg leading-snug">
							{selected.title}
						</h3>
						<div className="flex flex-col gap-2 text-sm">
							<div className="text-muted-foreground">
								{new Date(selected.startDate).toLocaleDateString("de-DE", {
									day: "2-digit",
									month: "short",
									year: "numeric",
								})}{" "}
								·{" "}
								{new Date(selected.startDate).toLocaleTimeString("de-DE", {
									timeStyle: "short",
								})}
							</div>
							{selected.location && (
								<div className="text-muted-foreground">{selected.location}</div>
							)}
						</div>
						<div className="mt-5 flex gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="border border-success/30 text-success hover:bg-success/15 hover:text-success"
								onClick={onAccept}
							>
								{t("Accept")}
							</Button>
							<Button asChild variant="outline" size="sm">
								<Link to="/appts/$apptId" params={{ apptId: selected.id }}>
									{t("Open appointment")}
								</Link>
							</Button>
						</div>
					</>
				) : (
					<div className="text-muted-foreground text-sm">
						{t("No appointments found")}
					</div>
				)}
			</div>
		</div>
	);
};

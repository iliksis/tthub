import { createFileRoute } from "@tanstack/react-router";
import { getActiveSeason, getSeasons } from "@/api/seasons";
import { CreateAppointmentForm } from "@/components/CreateAppointmentForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_authed/create")({
	beforeLoad: async ({ context }) => {
		if (
			!context.user ||
			(context.user.role !== "ADMIN" && context.user.role !== "EDITOR")
		) {
			throw Error("Forbidden");
		}
	},
	component: RouteComponent,
	errorComponent: () => {
		return (
			<Alert variant="destructive">
				<AlertDescription>
					{m.appointments_you_do_not_have_permission_to_create_appointments()}
				</AlertDescription>
			</Alert>
		);
	},
	head: () => ({
		meta: [{ title: m.appointments_create_appointment() }],
	}),
	loader: async () => {
		const [seasonsRes, activeSeasonRes] = await Promise.all([
			getSeasons(),
			getActiveSeason(),
		]);
		return {
			activeSeason: activeSeasonRes.data,
			seasons: seasonsRes.data ?? [],
		};
	},
});

function RouteComponent() {
	const { seasons, activeSeason } = Route.useLoaderData();

	return (
		<div>
			<CreateAppointmentForm seasons={seasons} activeSeason={activeSeason} />
		</div>
	);
}

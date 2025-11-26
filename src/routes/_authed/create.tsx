import { createFileRoute } from "@tanstack/react-router";
import { CreateAppointmentForm } from "@/components/CreateAppointmentForm";

export const Route = createFileRoute("/_authed/create")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div>
			<CreateAppointmentForm />
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { CreateAppointmentForm } from "@/components/CreateAppointmentForm";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/create")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{
				title: t("Create appointment"),
			},
		],
	}),
});

function RouteComponent() {
	return (
		<div>
			<CreateAppointmentForm />
		</div>
	);
}

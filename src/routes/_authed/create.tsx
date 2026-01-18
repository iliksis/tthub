import { createFileRoute } from "@tanstack/react-router";
import { CreateAppointmentForm } from "@/components/CreateAppointmentForm";
import { t } from "@/lib/text";

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
			<div className="alert alert-error">
				{t("You do not have permission to create appointments")}
			</div>
		);
	},
	head: () => ({
		meta: [{ title: t("Create appointment") }],
	}),
});

function RouteComponent() {
	return (
		<div>
			<CreateAppointmentForm />
		</div>
	);
}

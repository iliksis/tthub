import { createFileRoute } from "@tanstack/react-router";
import {
	getNextAppointments,
	getUserAppointments,
	getUserAppointmentsWithoutResponses,
} from "@/api/appointments";
import { Card } from "@/components/appointments/Card";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/text";

export const Route = createFileRoute("/_authed/")({
	component: App,
	head: () => ({
		meta: [{ title: t("Dashboard") }],
	}),
	loader: async ({ context }) => {
		if (!context.user?.id) {
			throw new Error(t("Unauthorized"));
		}

		const promises = await Promise.all([
			getNextAppointments(),
			getUserAppointments({ data: { userId: context.user.id } }),
			getUserAppointmentsWithoutResponses({
				data: { userId: context.user.id },
			}),
		]);

		const nextData = promises[0];
		const nextRes = await nextData.json();
		if (nextData.status >= 400) {
			throw new Error(nextRes.message);
		}

		const userData = promises[1];
		const userRes = await userData.json();
		if (userData.status >= 400) {
			throw new Error(userRes.message);
		}

		const withoutResponsesData = promises[2];
		const withoutResponsesRes = await withoutResponsesData.json();
		if (withoutResponsesData.status >= 400) {
			throw new Error(withoutResponsesRes.message);
		}

		return {
			nextAppointments: nextRes.data,
			userAppointments: userRes.data,
			withoutResponses: withoutResponsesRes.data,
		};
	},
});

function App() {
	const { nextAppointments, userAppointments, withoutResponses } =
		Route.useLoaderData();
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<div className="flex flex-row">
					<h2 className="font-bold flex-1">{t("Upcoming appointments")}</h2>
					{nextAppointments && (
						<Badge variant="secondary" className="shrink-0">
							{nextAppointments.length}
						</Badge>
					)}
				</div>
				{nextAppointments && nextAppointments.length > 0 ? (
					nextAppointments.map((a) => <Card key={a.id} appointment={a} />)
				) : (
					<div> {t("No appointments in the next 4 weeks")}</div>
				)}
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex flex-row">
					<h2 className="font-bold flex-1"> {t("Your appointments")}</h2>
					{userAppointments && (
						<Badge variant="secondary" className="shrink-0">
							{userAppointments.length}
						</Badge>
					)}
				</div>
				{userAppointments && userAppointments.length > 0 ? (
					userAppointments.map((a) => <Card key={a.id} appointment={a} />)
				) : (
					<div>{t("You have no appointments")}</div>
				)}
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex flex-row">
					<h2 className="font-bold flex-1">{t("Pending appointments")}</h2>
					{withoutResponses && (
						<Badge variant="secondary" className="shrink-0">
							{withoutResponses.length}
						</Badge>
					)}
				</div>
				{withoutResponses && withoutResponses.length > 0 ? (
					withoutResponses.map((a) => <Card key={a.id} appointment={a} />)
				) : (
					<div> {t("You responded to all appointments")}</div>
				)}
			</div>
		</div>
	);
}

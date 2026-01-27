import { createFileRoute } from "@tanstack/react-router";
import type { FeedConfig } from "@/api/users";
import { prismaClient } from "@/lib/db";
import { IcalGenerator } from "@/lib/ical";
import type { Appointment, Prisma } from "@/lib/prisma/client";
import type { AppointmentType, ResponseType } from "@/lib/prisma/enums";

export const Route = createFileRoute("/feed/$feedId")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const { feedId } = params;

				try {
					// Find user by feedId
					const user = await prismaClient.user.findUnique({
						select: {
							feedConfig: true,
							id: true,
							responses: {
								include: {
									appointment: true,
								},
							},
						},
						where: { feedId },
					});

					if (!user) {
						return new Response("Feed not found", { status: 404 });
					}

					// Parse feed configuration from database
					const config: FeedConfig = {
						includeAppointmentTypes: user.feedConfig?.includeAppointmentTypes
							? (user.feedConfig.includeAppointmentTypes.split(
									",",
								) as AppointmentType[])
							: undefined,
						includeDraftStatus: user.feedConfig?.includeDraftStatus ?? false,
						includeResponseTypes: user.feedConfig?.includeResponseTypes
							? (user.feedConfig.includeResponseTypes.split(
									",",
								) as ResponseType[])
							: undefined,
					};

					// Build query for appointments
					const where: Prisma.AppointmentWhereInput = {
						deletedAt: null,
					};

					// Filter by appointment types if configured
					where.type = { in: config.includeAppointmentTypes ?? [] };

					// Filter by draft status if configured
					if (config.includeDraftStatus === false) {
						where.OR = [{ status: "PUBLISHED" }, { status: null }];
					}

					// Get appointments based on response types
					let appointments: Appointment[] = [];

					if (
						config.includeResponseTypes &&
						config.includeResponseTypes.length > 0
					) {
						// Filter by user's responses
						const userResponses = user.responses.filter((r) =>
							config.includeResponseTypes?.includes(r.responseType),
						);

						const appointmentIds = userResponses.map((r) => r.appointmentId);

						if (appointmentIds.length > 0) {
							appointments = await prismaClient.appointment.findMany({
								orderBy: { startDate: "asc" },
								where: {
									...where,
									id: { in: appointmentIds },
								},
							});
						}
					} else {
						// No response filter, get all appointments matching other criteria
						appointments = await prismaClient.appointment.findMany({
							orderBy: { startDate: "asc" },
							where,
						});
					}

					// Generate iCal feed
					const icalGenerator = new IcalGenerator();
					const icalContent = icalGenerator.createIcalString(...appointments);

					return new Response(icalContent, {
						headers: {
							"Content-Disposition": 'attachment; filename="tthub-feed.ics"',
							"Content-Type": "text/calendar; charset=utf-8",
						},
						status: 200,
					});
				} catch (error) {
					console.error("Feed generation error:", error);
					return new Response("Internal server error", { status: 500 });
				}
			},
		},
	},
});

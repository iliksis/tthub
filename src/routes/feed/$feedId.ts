import { createFileRoute } from "@tanstack/react-router";
import { parseFeedConfig } from "@/api/users";
import { prismaClient } from "@/lib/db";
import { IcalGenerator } from "@/lib/ical";
import type { Appointment, Prisma } from "@/lib/prisma/client";

export const Route = createFileRoute("/feed/$feedId")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
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
					const config = parseFeedConfig(user.feedConfig);

					// Build query for appointments
					// Deliberately not season-scoped: a personal calendar feed is
					// meant to span season boundaries, so appointments from every
					// season are eligible here.
					const where: Prisma.AppointmentWhereInput = {
						deletedAt: null,
					};

					// Filter by appointment types if configured
					where.type = { in: config.includeAppointmentTypes ?? [] };

					// Filter by draft status if configured
					if (config.includeDraftStatus === false) {
						where.OR = [{ status: "PUBLISHED" }, { status: null }];
					}

					// Exclude-by-label only (no include-by-label): an appointment
					// carrying any excluded label is omitted entirely, regardless of
					// its other labels.
					if (config.excludeLabelIds?.length) {
						where.labels = {
							none: { labelId: { in: config.excludeLabelIds } },
						};
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
					const icalGenerator = new IcalGenerator(new URL(request.url).origin);
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

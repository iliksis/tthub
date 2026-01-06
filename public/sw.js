self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});

self.addEventListener("push", (event) => {
	if (!event.data) {
		return;
	}
	const payload = event.data.json();
	const { body, icon, image, badge, url, title } = payload;
	const notificationTitle = title || "TT Hub";
	const notificationOptions = {
		body,
		icon,
		image,
		badge,
		data: { url },
	};
	event.waitUntil(
		self.registration
			.showNotification(notificationTitle, notificationOptions)
			.then(() => console.log("Notification shown."))
	);
});

self.addEventListener("notificationclick", (e) => {
	e.waitUntil(clients.openWindow(e.notification.data.url));
	e.notification.close();
});
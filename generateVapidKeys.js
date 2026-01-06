import fs from "node:fs";
import webPush from "web-push";

const vapidKeys = webPush.generateVAPIDKeys();

fs.appendFile(
	".env.local",
	`\nVAPID_PRIVATE_KEY=${vapidKeys.privateKey}\nVITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`,
	(err) => {
		if (err) {
			console.error(err);
		}
		console.log("VAPID keys generated");
		return;
	},
);

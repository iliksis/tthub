// Nitro loads the SSR entry (src/server.ts), where the nightly Season
// Statistics refresh is started, lazily on the first request. Importing it at
// boot starts the job right after a deploy instead of after the first visit.
export default function loadServerEntryAtBoot() {
	// Virtual module that nitro defines at build time; it has no type declaration.
	// @ts-expect-error
	import("#tanstack/start/entry").catch((e) => {
		console.error("Failed to load the server entry at boot", e);
	});
}

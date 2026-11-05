// Nitro loads the SSR entry (src/server.ts), where the nightly Season
// Statistics refresh is started, lazily on the first request. Importing it at
// boot starts the job right after a deploy instead of after the first visit.
//
// `#tanstack/start/entry` is a virtual module that
// @tanstack/nitro-v2-vite-plugin defines at build time, not a public API.
// Verified with @tanstack/react-start 1.168.40, @tanstack/nitro-v2-vite-plugin
// 1.155.0 and nitropack 2.13.4. After upgrading any of them, run a production
// build and check the boot log for "Season Statistics refresh scheduled".
export default function loadServerEntryAtBoot() {
	// Virtual module that nitro defines at build time; it has no type declaration.
	// @ts-expect-error
	import("#tanstack/start/entry").catch((e) => {
		console.error(
			"Failed to load the server entry at boot; the nightly Season Statistics refresh will not be scheduled until the first request",
			e,
		);
	});
}

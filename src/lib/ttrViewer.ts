const DEFAULT_TTR_VIEWER_URL = "https://ttr.tmueller.dev";

/** Base URL of the ttr-viewer service, without a trailing slash. Works on client and server. */
export const ttrViewerBaseUrl = (
	configured: string | undefined = import.meta.env.VITE_TTR_VIEWER_URL,
) => (configured?.trim() || DEFAULT_TTR_VIEWER_URL).replace(/\/+$/, "");

export const ttrViewerPlayerUrl = (myTTId: string, configured?: string) =>
	`${ttrViewerBaseUrl(configured)}/player/${encodeURIComponent(myTTId)}`;

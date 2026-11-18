/** Base URL of the ttr-viewer service without trailing slash, or null when not configured. Works on client and server. */
export const ttrViewerBaseUrl = (
	configured: string | undefined = import.meta.env.VITE_TTR_VIEWER_URL,
) => configured?.trim().replace(/\/+$/, "") || null;

export const ttrViewerPlayerUrl = (myTTId: string) => {
	const base = ttrViewerBaseUrl();
	return base ? `${base}/player/${encodeURIComponent(myTTId)}` : null;
};

import OpengraphImage from "./opengraph-image";

export const runtime = "edge";
export const alt = "VentraMatch — fundraising matched.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Twitter uses the same image as Open Graph; route handler reuses the
// component but redeclares the route-segment config (Next.js disallows
// re-exporting these fields).
export default OpengraphImage;

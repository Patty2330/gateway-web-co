import type { CSSProperties } from "react";

/**
 * Shared style for the sample-mode and pages-demo banners.
 * These stay in document flow (not sticky) so a wrapped banner on a phone
 * cannot sit on top of the site header.
 */
export const topBannerStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "#7a1f1f",
  color: "#fff",
  textAlign: "center",
  fontWeight: 700,
  fontSize: "0.95rem",
  lineHeight: 1.4,
  padding: "0.6rem 1rem",
};

export const stickyHeaderTopClass = "top-0";

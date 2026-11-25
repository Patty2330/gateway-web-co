"use client";

import { useSyncExternalStore } from "react";

// Stable prerender/hydration value. After hydration the client shows the real year.
const SERVER_YEAR = "2026";

function currentYear() {
  return String(new Date().getFullYear());
}

export function FooterYear() {
  const year = useSyncExternalStore(
    () => () => {},
    currentYear,
    () => SERVER_YEAR,
  );
  return <span>{year}</span>;
}

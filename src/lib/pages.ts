/** True only in the GitHub Pages static build. */
export function isPagesDemo(): boolean {
  return process.env.NEXT_PUBLIC_PAGES_DEMO === "1";
}

/** Prefix a root-relative URL when the site is served from /gateway-web-co. */
export function sitePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  let pathname = hashAt >= 0 ? path.slice(0, hashAt) : path;
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  if (base && pathname !== "/" && !pathname.endsWith("/") && !pathname.includes(".")) {
    pathname = `${pathname}/`;
  }
  if (pathname === "/" && base) return `${base}/${hash}`;
  return `${base}${pathname}${hash}`;
}

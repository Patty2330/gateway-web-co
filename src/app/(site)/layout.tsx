import type { ReactNode } from "react";

import { sitePath } from "@/lib/pages";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href={sitePath("/styles.css")} />
      {children}
    </>
  );
}

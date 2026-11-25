"use client";

import { useEffect, useState } from "react";

export function FooterYear() {
  const [year, setYear] = useState("2026");
  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);
  return <span>{year}</span>;
}

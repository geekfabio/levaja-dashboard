"use client";

import { useEffect, type ReactNode } from "react";

const AREA_SCRIPT = `document.documentElement.setAttribute("data-area","admin")`;

export default function AdminArea({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-area", "admin");
    return () => root.removeAttribute("data-area");
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: AREA_SCRIPT }} />
      {children}
    </>
  );
}

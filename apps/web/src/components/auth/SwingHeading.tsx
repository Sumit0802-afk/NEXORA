"use client";

import { useEffect, useState } from "react";
import TextEngine from "spring-text-engine";

type Tag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** Letters swing in from a tilt and settle level. Falls back to plain text when motion is reduced. */
export function SwingHeading({ tag, className, children }: { tag: Tag; className?: string; children: string }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  if (reduced) {
    const Plain = tag;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <TextEngine
      // Remount when the text changes (Sign in / Create account) so the swing plays again.
      key={children}
      tag={tag}
      mode="once"
      letterOut={{ opacity: 0, rotate: -18 }}
      letterIn={{ opacity: 1, rotate: 0 }}
      letterConfig={{ tension: 240, friction: 18 }}
      letterStagger={30}
      className={className}
    >
      {children}
    </TextEngine>
  );
}

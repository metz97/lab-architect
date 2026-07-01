import type { Metadata } from "next";

/** Minimal, self-contained page-title helper for standalone lab repos. */
export function pageTitle(title: string): Metadata {
  return { title };
}

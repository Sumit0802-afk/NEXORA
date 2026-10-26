/** Only same-site relative paths are allowed as a post-login destination (blocks open redirects). */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || raw.startsWith("/login")) return "/";
  return raw;
}

export function loginUrl(returnTo: string): string {
  const next = safeNext(returnTo);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}

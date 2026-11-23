// Post-login redirects must stay on this site. Only same-origin relative paths
// pass; "//evil.com", "/\evil.com" and absolute URLs would hand the freshly
// signed-in user to another host.
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

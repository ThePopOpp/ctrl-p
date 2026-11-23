// Public URLs for the connector. The advertised resource must match the URL
// given to Claude/ChatGPT (https://controlp.io/api/mcp), even behind a proxy.
// MCP_SITE_URL overrides; locally the request's own origin is used.
export function siteOrigin(req: Request) {
  const configured = process.env.MCP_SITE_URL || (process.env.NODE_ENV === "production" ? "https://controlp.io" : "");
  const origin = configured ? (/^https?:\/\//.test(configured) ? configured : `https://${configured}`) : new URL(req.url).origin;
  return origin.replace(/\/$/, "");
}

export const mcpResource = (req: Request) => `${siteOrigin(req)}/api/mcp`;
export const resourceMetadataUrl = (req: Request) => `${siteOrigin(req)}/.well-known/oauth-protected-resource`;
export const authorizationServer = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1`;

// Bearer tokens, not cookies, so any origin may call (browser-based MCP clients).
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

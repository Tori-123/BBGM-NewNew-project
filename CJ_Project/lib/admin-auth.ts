import { env } from "cloudflare:workers";

export function isAdminRequest(request: Request) {
  const provided = request.headers.get("x-cj-admin-code") ?? "";
  const configured = String(env.CJ_ADMIN_CODE ?? "").trim();
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return configured ? provided === configured : isLocal && provided === "CJ-DEMO";
}

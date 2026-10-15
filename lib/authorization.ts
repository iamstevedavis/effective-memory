import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest, NextResponse } from "next/server";
import { query } from "./db";
import { authAdapter } from "./auth-adapter";
const owners = new AsyncLocalStorage<string>();
export function currentOwner() { const owner = owners.getStore(); if (!owner) throw new Error("Owner context missing"); return owner; }
export async function ownerId(req: NextRequest) {
  const cookie = req.cookies.get("__Secure-next-auth.session-token")?.value ?? req.cookies.get("next-auth.session-token")?.value;
  if (!cookie || cookie.length > 512) return null;
  return (await authAdapter.getSessionAndUser!(cookie))?.user.id ?? null;
}
export async function chargeGeneration(owner: string, amount = 1, kind = "generation") {
  const configured = Number(process.env.OWNER_GENERATION_DAILY_LIMIT ?? 25);
  const limit = kind === "preview" ? 120 : Number.isSafeInteger(configured) && configured > 0 ? configured : 25;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > limit) return false;
  return !!(await query(`INSERT INTO owner_usage(owner_id,day,kind,calls) VALUES($1,(now() AT TIME ZONE 'UTC')::date,$2,$3)
    ON CONFLICT(owner_id,day,kind) DO UPDATE SET calls=owner_usage.calls+$3 WHERE owner_usage.calls+$3<=$4 RETURNING calls`, [owner,kind,amount,limit])).rowCount;
}
export function ownerRoute(handler: (req: NextRequest, context: any) => Promise<Response>) {
  return async (req: NextRequest, context?: any) => {
    const deny = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
    try {
      const owner = await ownerId(req);
      if (!owner) return deny(401, "Sign in to access your business");
      const path = req.nextUrl.pathname, mutation = !["GET", "HEAD"].includes(req.method);
      let input: Record<string, unknown> = {};
      if (mutation) {
        const expected = process.env.NEXTAUTH_URL;
        if (!expected || req.headers.get("origin") !== new URL(expected).origin || req.headers.get("sec-fetch-site") === "cross-site") return deny(403, "Same-origin request required");
        const reader = req.clone().body?.getReader(); let bytes = 0;
        if (reader) { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 1500000) { void reader.cancel(); return deny(413, "Upload exceeds 1.5 MB"); } } }
        const copy = req.clone();
        if (req.headers.get("content-type")?.startsWith("multipart/form-data")) input = Object.fromEntries(await copy.formData());
        else input = await copy.json();
      }
      let businessId: unknown, draftId: unknown;
      if (path === "/api/businesses" || path === "/api/branding/preview" || path === "/api/drafts/bulk") { /* owner-wide operations */ }
      else if (/^\/api\/businesses\/\d+$/.test(path)) businessId = path.split("/").pop();
      else if (["/api/reviews", "/api/drafts", "/api/generation", "/api/posting-slots"].includes(path)) businessId = mutation ? input.businessId : req.nextUrl.searchParams.get("businessId");
      else if (["/api/reviews/import", "/api/quotes/select", "/api/posting-slots", "/api/posting-slots/assign"].includes(path)) businessId = input.businessId;
      else if (/^\/api\/(drafts\/(caption|status|schedule)|generation\/(retry|regenerate)|captions\/generate|images\/render)$/.test(path)) draftId = input.draftPostId;
      else if (path.startsWith("/api/media/")) {
        const exists = await query("SELECT 1 FROM draft_posts d JOIN businesses b ON b.id=d.business_id WHERE b.owner_id=$1 AND d.image_path=$2", [owner,path]);
        if (!exists.rowCount) return deny(404, "Image not found");
      } else return deny(403, "Unrecognized protected operation");
      if (businessId !== undefined || draftId !== undefined) {
        const id = Number(businessId ?? draftId);
        if (!Number.isSafeInteger(id) || id <= 0) return deny(400, "Valid resource ID required");
        const exists = draftId !== undefined ? await query("SELECT 1 FROM draft_posts d JOIN businesses b ON b.id=d.business_id WHERE d.id=$1 AND b.owner_id=$2", [id,owner]) : await query("SELECT 1 FROM businesses WHERE id=$1 AND owner_id=$2", [id,owner]);
        if (!exists.rowCount) return deny(404, "Resource not found");
      } else if (!["/api/businesses", "/api/branding/preview", "/api/drafts/bulk"].includes(path) && !path.startsWith("/api/media/")) return deny(400, "Resource ID required");
      if (["/api/captions/generate", "/api/images/render"].includes(path) && !await chargeGeneration(owner)) return deny(429, "Daily generation limit reached");
      if (path === "/api/branding/preview" && !await chargeGeneration(owner, 1, "preview")) return deny(429, "Preview limit reached");
      const response = await owners.run(owner, () => handler(req, context));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch { return deny(500, "Request failed; check configuration or retry"); }
  };
}

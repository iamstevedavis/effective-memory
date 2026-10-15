import { ownerRoute } from "../../../../lib/authorization";
import { NextRequest, NextResponse } from "next/server";
import { renderQuoteCard } from "../../../../lib/services/imageRenderer";
import { parseBrandColors, isBrandTone, validBrandConfig } from "../../../../lib/branding";
async function handlePOST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!validBrandConfig(body.brandColors)) throw new Error("Invalid configuration");
    const colors = parseBrandColors(body.brandColors);
    const png = await renderQuoteCard({ draftPostId: 0, businessName: "Sample business",
      quoteText: "A warm welcome and thoughtful service. We look forward to coming back!",
      brandHex: colors.primary, secondaryBrandHex: colors.secondary, templateConfig: colors,
      brandTone: isBrandTone(body.brandTone) ? body.brandTone : "friendly" });
    return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Use supported template options and six-digit brand colors" }, { status: 400 }); }
}

export const POST = ownerRoute(handlePOST);

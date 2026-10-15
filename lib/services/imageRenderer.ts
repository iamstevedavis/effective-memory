import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";
import { quoteOptions, type BrandTone } from "../branding";
import { draftImageFilename, draftImageUrl, mediaRoot } from "./media";

const escapeMarkup = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function foreground(hex: string): string {
  const rgb = hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
function color(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (!/^#[a-f\d]{6}$/i.test(value)) throw new Error("Use six-digit hexadecimal brand colors");
  return value;
}
async function layout(text: string, width: number, height: number, sizes: number[], fill: string, serif: boolean) {
  if (!text.trim() || text.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw new Error("Text is empty, unsupported, or too long; select a shorter verbatim quote");
  }
  for (const size of sizes) {
    const { data, info } = await sharp({ text: {
      text: `<span foreground="${fill}">${escapeMarkup(text)}</span>`,
      font: `DejaVu ${serif ? "Serif" : "Sans"} ${size}`, width, rgba: true, wrap: "word-char", dpi: 72
    }}).png().toBuffer({ resolveWithObject: true });
    if (info.width <= width && info.height <= height) return { input: data };
  }
  throw new Error("Text does not fit safely; select a shorter verbatim quote or business display name");
}
export type RenderParams = {
  draftPostId: number; businessName: string; quoteText: string;
  brandHex?: string | null; secondaryBrandHex?: string | null;
  logoUrl?: string | null; brandTone?: BrandTone; templateConfig?: unknown;
};
export async function renderQuoteCard(params: RenderParams) {
  const options = quoteOptions(params.templateConfig);
  const primary = color(params.brandHex, "#1f2937"), secondary = color(params.secondaryBrandHex, "#374151");
  const ink = foreground(primary);
  let logo: Buffer | undefined;
  if (params.logoUrl) {
    // Only embedded, bounded raster uploads: no URL fetching, redirects, SVG, or SSRF surface.
    if (params.logoUrl.length > 350000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(params.logoUrl)) {
      throw new Error("Logo must be a PNG/JPEG/WebP data upload under 256 KB; remote URLs are unsupported");
    }
    const bytes = Buffer.from(params.logoUrl.split(",")[1], "base64");
    if (bytes.length > 256000) throw new Error("Logo exceeds 256 KB");
    try {
      const image = sharp(bytes, { limitInputPixels: 4000000, animated: false });
      const metadata = await image.metadata();
      if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error();
      logo = await image.resize(140, 140, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    } catch { throw new Error("Invalid raster logo; upload a valid nonanimated image under 4 megapixels"); }
  }
  const name = await layout(params.businessName, logo ? 720 : 920, 160, [46, 40, 34, 28], ink, false);
  const quote = await layout(`“${params.quoteText}”`, 920, 650, options.quoteSize === "large" ? [56, 52, 48, 44, 40] : [48, 44, 40, 36, 32], ink, params.brandTone === "premium");
  const layers: OverlayOptions[] = [
    { input: { create: { width: 1080, height: 14, channels: 4, background: secondary } }, top: 0, left: 0 },
    { ...name, top: 80, left: 80 }, { ...quote, top: 300, left: 80 }
  ];
  if (logo) layers.push({ input: logo, top: 70, left: 860 });
  const png = await sharp({ create: { width: 1080, height: 1080, channels: 4, background: primary } }).composite(layers).png().toBuffer();
  return png;
}
export async function renderDraftImage(params: RenderParams) {
  const png = await renderQuoteCard(params);
  const root = mediaRoot();
  mkdirSync(root, { recursive: true });
  const outPath = join(root, draftImageFilename(params.draftPostId));
  const temp = `${outPath}.${randomUUID()}.tmp`;
  writeFileSync(temp, png);
  renameSync(temp, outPath);
  return { fileSystemPath: outPath, publicPath: draftImageUrl(params.draftPostId) };
}

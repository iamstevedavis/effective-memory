import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderDraftImage(params: {
  draftPostId: number;
  businessName: string;
  quoteText: string;
  brandHex?: string | null;
  logoUrl?: string | null;
}) {
  const width = 1080;
  const height = 1080;
  const bg = params.brandHex && /^#?[0-9a-fA-F]{6}$/.test(params.brandHex)
    ? (params.brandHex.startsWith("#") ? params.brandHex : `#${params.brandHex}`)
    : "#1f2937";

  const business = esc(params.businessName);
  const quote = esc(params.quoteText);
  const logoBlock = params.logoUrl
    ? `<text x="80" y="180" fill="#ffffff" font-size="28" font-family="Arial">logo: ${esc(params.logoUrl)}</text>`
    : "";

  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bg}" />
    <text x="80" y="100" fill="#ffffff" font-size="46" font-weight="700" font-family="Arial">${business}</text>
    ${logoBlock}
    <foreignObject x="80" y="250" width="920" height="680">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:#ffffff;font-size:48px;line-height:1.25;">
        “${quote}”
      </div>
    </foreignObject>
  </svg>`;

  const outDir = join(process.cwd(), "public", "generated");
  mkdirSync(outDir, { recursive: true });
  const filename = `draft-${params.draftPostId}.png`;
  const outPath = join(outDir, filename);

  const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  writeFileSync(outPath, png);

  return { fileSystemPath: outPath, publicPath: `/generated/${filename}` };
}

import sharp from "sharp";
export async function rasterLogo(input?: string | null): Promise<Buffer | undefined> {
  if (!input) return undefined;

  // Only embedded, bounded raster uploads: no URL fetching, redirects, SVG, or SSRF surface.
  if (input.length > 350000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input)) {
    throw new Error("Logo must be a PNG/JPEG/WebP data upload under 256 KB; remote URLs are unsupported");
  }
  const bytes = Buffer.from(input.split(",")[1], "base64");
  if (bytes.length > 256000) throw new Error("Logo exceeds 256 KB");
  try {
    const image = sharp(bytes, { limitInputPixels: 4000000, animated: false });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error();
    return await image.resize(140, 140, { fit: "contain", background: "#ffffff" }).png().toBuffer();
  } catch { throw new Error("Invalid raster logo; upload a valid nonanimated image under 4 megapixels"); }

}

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { foreground, renderDraftImage } from "../lib/services/imageRenderer";
async function main() {
  const root = mkdtempSync(join(tmpdir(), "quote-cards-"));
  process.env.MEDIA_ROOT = root;
  try {
    const logo = await sharp({ create: { width: 30, height: 30, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const base = { draftPostId: 901, businessName: "Synthetic Café & Bakery", quoteText: "Warm welcome, lovely coffee — merci! Καλημέρα", brandHex: "#ffffff", logoUrl: `data:image/png;base64,${logo.toString("base64")}` };
    const result = await renderDraftImage(base);
    const bytes = readFileSync(result.fileSystemPath);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 1080); assert.equal(meta.height, 1080); assert.equal(meta.format, "png");
    const pixel = await sharp(bytes).extract({ left: 920, top: 130, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], [255, 0, 0], "actual logo pixels appear");
    const region = await sharp(bytes).extract({ left: 80, top: 300, width: 920, height: 650 }).stats();
    assert.ok(region.channels[0].min < 50, "real text backend draws visible quote glyphs");
    assert.equal(foreground("#ffffff"), "#000000"); assert.equal(foreground("#000000"), "#ffffff");
    const changed = await renderDraftImage({ ...base, draftPostId: 902, quoteText: "A different synthetic quote" });
    assert.notDeepEqual(bytes, readFileSync(changed.fileSystemPath));
    await renderDraftImage({ ...base, draftPostId: 903, logoUrl: null, brandHex: "#000000", businessName: "A long synthetic business name with several words".repeat(2), quoteText: "A beautifully welcoming place. ".repeat(22) });
    await assert.rejects(renderDraftImage({ ...base, logoUrl: "http://169.254.169.254/secret" }), /remote URLs/);
    await assert.rejects(renderDraftImage({ ...base, logoUrl: "data:image/png;base64,YWJj" }), /Invalid raster/);
    await assert.rejects(renderDraftImage({ ...base, quoteText: "word ".repeat(1500) }), /too long/);
    await assert.rejects(renderDraftImage({ ...base, brandHex: "red" }), /hexadecimal/);
    // Optional review evidence persists outside source control.
    if (process.env.IMAGE_EVIDENCE_DIR) {
      const { mkdirSync, copyFileSync, readdirSync } = await import("node:fs");
      mkdirSync(process.env.IMAGE_EVIDENCE_DIR, { recursive: true });
      for (const id of [901, 902, 903]) copyFileSync(join(root, readdirSync(root).find(n => n.startsWith(`draft-${id}-`))!), join(process.env.IMAGE_EVIDENCE_DIR, `synthetic-${id}.png`));
    }
    console.log("real raster layout/logo/overflow tests passed");
  } finally { rmSync(root, { recursive: true, force: true }); }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });

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
    const base = { draftPostId: 901, businessName: "Synthetic Café & Bakery", quoteText: "Warm welcome, lovely coffee — merci! Καλημέρα", brandHex: "#ffffff", logoUrl: `data:image/png;base64,${logo.toString("base64")}`, rating: 5, authorName: "Synthetic reviewer" };
    const result = await renderDraftImage(base);
    const bytes = readFileSync(result.fileSystemPath);
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 1080); assert.equal(meta.height, 1080); assert.equal(meta.format, "png");
    const pixel = await sharp(bytes).extract({ left: 920, top: 920, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], [255, 0, 0], "actual logo pixels appear bottom right");
    const star = await sharp(bytes).extract({ left: 102, top: 104, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...star], [0x9a, 0x5a, 0x0b], "rating stars appear top left");
    const reviewer = await sharp(bytes).extract({ left: 80, top: 860, width: 700, height: 140 }).stats();
    assert.ok(reviewer.channels[0].min < 50, "reviewer and business names are drawn bottom left");
    const region = await sharp(bytes).extract({ left: 80, top: 300, width: 920, height: 650 }).stats();
    assert.ok(region.channels[0].min < 50, "real text backend draws visible quote glyphs");
    assert.equal(foreground("#ffffff"), "#000000"); assert.equal(foreground("#000000"), "#ffffff");
    const changed = await renderDraftImage({ ...base, draftPostId: 902, quoteText: "A different synthetic quote" });
    assert.notDeepEqual(bytes, readFileSync(changed.fileSystemPath));
    await renderDraftImage({ ...base, draftPostId: 903, logoUrl: null, rating: null, authorName: null, brandHex: "#000000", businessName: "A long synthetic business name with several words".repeat(2), quoteText: "A beautifully welcoming place. ".repeat(22) });
    await renderDraftImage({ ...base, draftPostId: 904, authorName: "Maximiliana Alexandrina\nWolfeschlegelsteinhausen-Bergerdorff of Synthetic Upon Avon" });
    await assert.rejects(renderDraftImage({ ...base, authorName: "Synthetic reviewer ".repeat(20) }), /does not fit/, "an unfit reviewer name is rejected, not dropped");
    const crowded = readFileSync((await renderDraftImage({ ...base, draftPostId: 905, authorName: null, quoteText: "W".repeat(240) })).fileSystemPath);
    // The logo is drawn last and would hide an overlapping quote, so check the quote ends above it.
    const gap = await sharp(crowded).extract({ left: 80, top: 822, width: 920, height: 36 }).removeAlpha().raw().toBuffer();
    assert.ok(gap.every(value => value === 255), "a long quote stops above the logo");
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

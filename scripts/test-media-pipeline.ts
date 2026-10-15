// Domain regressions bypass the boundary; test-authorization exercises real guards.
const boundary = require("../lib/authorization");
boundary.ownerRoute = (handler: unknown) => handler;
boundary.currentOwner = () => "synthetic-owner";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDraftGenerationRunner } from "../lib/services/draftPipeline";
import { selectQuoteCandidates } from "../lib/services/quoteSelector";
import { renderDraftImage } from "../lib/services/imageRenderer";

// End-to-end smoke (issue #41): import synthetic reviews, select quotes,
// generate fake-provider captions, render, persist, and fetch the image back
// through the web media route. No API key, no external network, no database.

const dbModule = require("../lib/db");

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

async function main() {
  const mediaDir = mkdtempSync(join(tmpdir(), "praise-loop-media-"));
  const previousMediaRoot = process.env.MEDIA_ROOT;
  process.env.MEDIA_ROOT = mediaDir;

  const updatedImages: Array<{ id: number; imagePath: string }> = [];
  const updatedCaptions: Array<{ id: number; caption: string }> = [];

  dbModule.query = async (sql: string) => {
    if (sql.includes("FROM businesses")) {
      return {
        rows: [
          {
            id: 7,
            name: "Cafe Nova",
            brand_colors: { primary: "#112233", secondary: "#334455" },
            logo_url: null,
            brand_tone: "premium"
          }
        ],
        rowCount: 1
      };
    }
    if (sql.includes("FROM reviews")) {
      return {
        rows: [
          {
            id: 501,
            business_id: 7,
            rating: 5,
            text: "Amazing coffee and the friendliest staff in town",
            reviewed_at: new Date().toISOString()
          }
        ],
        rowCount: 1
      };
    }
    if (sql.startsWith("INSERT")) {
      return { rows: [{ id: 101 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  };

  try {
    const run = createDraftGenerationRunner({
      listBusinesses: async () => {
        const res = await dbModule.query("SELECT id, name, brand_colors, logo_url, brand_tone FROM businesses");
        return res.rows;
      },
      selectQuoteCandidates,
      generateCaptionVariants: async () => ({
        friendly: "Cafe Nova made our day ☕",
        premium: "An elevated evening, made memorable at Cafe Nova.",
        playful: "Coffee joy unlocked at Cafe Nova!"
      }),
      updateDraftCaption: async (id, caption) => {
        updatedCaptions.push({ id, caption });
      },
      renderDraftImage,
      updateDraftImagePath: async (id, imagePath) => {
        updatedImages.push({ id, imagePath });
      },
      markDraftFailed: async () => {
        throw new Error("should not mark failed in smoke test");
      }
    });

    const result = await run({ perBusinessLimit: 5 });

    assert.deepEqual(result, {
      businessesScanned: 1,
      candidatesInserted: 1,
      draftsCompleted: 1,
      draftsFailed: 0
    });
    assert.deepEqual(updatedCaptions, [
      { id: 101, caption: "An elevated evening, made memorable at Cafe Nova." }
    ]);
    assert.deepEqual(updatedImages, [{ id: 101, imagePath: "/api/media/draft-101.png" }]);

    const renderedPath = join(mediaDir, "draft-101.png");
    assert.ok(existsSync(renderedPath), "rendered image must persist to the media root");

    const mediaRoute = require("../app/api/media/[name]/route");

    const okRes = await mediaRoute.GET(null, { params: Promise.resolve({ name: "draft-101.png" }) });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.headers.get("content-type"), "image/png");
    const body = new Uint8Array(await okRes.arrayBuffer());
    assert.ok(body.length > 0, "image body must be non-empty");
    assert.deepEqual([...body.slice(0, 4)], PNG_MAGIC, "response must be a PNG");

    const missingRes = await mediaRoute.GET(null, { params: Promise.resolve({ name: "draft-999.png" }) });
    assert.equal(missingRes.status, 404);

    const traversalRes = await mediaRoute.GET(null, {
      params: Promise.resolve({ name: "..%2F..%2Fetc%2Fpasswd" })
    });
    assert.equal(traversalRes.status, 404);

    console.log("media pipeline smoke tests passed");
  } finally {
    if (previousMediaRoot === undefined) delete process.env.MEDIA_ROOT;
    else process.env.MEDIA_ROOT = previousMediaRoot;
    rmSync(mediaDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});

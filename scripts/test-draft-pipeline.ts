import assert from "node:assert/strict";
import { createDraftGenerationRunner } from "../lib/services/draftPipeline";

async function successPathTest() {
  const updatedCaptions: Array<{ id: number; caption: string }> = [];
  const updatedImages: Array<{ id: number; imagePath: string }> = [];

  const run = createDraftGenerationRunner({
    listBusinesses: async () => [
      { id: 7, name: "Cafe Nova", brand_colors: { primary: "#112233" }, logo_url: null }
    ],
    selectQuoteCandidates: async () => [
      { draftPostId: 101, reviewId: 501, quoteText: "Amazing coffee and staff", score: 100 }
    ],
    generateCaptionVariants: async () => ({
      friendly: "Cafe Nova made our day ☕",
      premium: "",
      playful: ""
    }),
    updateDraftCaption: async (id, caption) => {
      updatedCaptions.push({ id, caption });
    },
    renderDraftImage: async () => ({ publicPath: "/generated/draft-101.png" }),
    updateDraftImagePath: async (id, imagePath) => {
      updatedImages.push({ id, imagePath });
    },
    markDraftFailed: async () => {
      throw new Error("should not mark failed in success path");
    }
  });

  const result = await run();

  assert.deepEqual(result, {
    businessesScanned: 1,
    candidatesInserted: 1,
    draftsCompleted: 1,
    draftsFailed: 0
  });
  assert.deepEqual(updatedCaptions, [{ id: 101, caption: "Cafe Nova made our day ☕" }]);
  assert.deepEqual(updatedImages, [{ id: 101, imagePath: "/generated/draft-101.png" }]);
}

async function failurePathTest() {
  const failures: Array<{ id: number; reason: string }> = [];

  const run = createDraftGenerationRunner({
    listBusinesses: async () => [
      { id: 8, name: "North Pizza", brand_colors: null, logo_url: null }
    ],
    selectQuoteCandidates: async () => [
      { draftPostId: 202, reviewId: 601, quoteText: "Great service", score: 88 }
    ],
    generateCaptionVariants: async () => {
      throw new Error("upstream timeout");
    },
    updateDraftCaption: async () => {
      throw new Error("should not update caption in failure path");
    },
    renderDraftImage: async () => {
      throw new Error("should not render in failure path");
    },
    updateDraftImagePath: async () => {
      throw new Error("should not update image in failure path");
    },
    markDraftFailed: async (id, reason) => {
      failures.push({ id, reason });
    }
  });

  const result = await run();

  assert.deepEqual(result, {
    businessesScanned: 1,
    candidatesInserted: 1,
    draftsCompleted: 0,
    draftsFailed: 1
  });
  assert.equal(failures.length, 1);
  assert.equal(failures[0].id, 202);
  assert.match(failures[0].reason, /pipeline_failed: upstream timeout/);
}

async function main() {
  await successPathTest();
  await failurePathTest();
  console.log("draft pipeline tests passed");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});

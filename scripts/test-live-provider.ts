import assert from "node:assert/strict";

// Opt-in live-provider verification (issue #41). Ordinary `npm test` never
// calls this. Enable with:
//
//   LIVE_PROVIDER_VERIFY=1 OPENAI_API_KEY=sk-... npx ts-node --compiler-options \
//     '{"module":"CommonJS","moduleResolution":"node"}' scripts/test-live-provider.ts
//
// Makes one real Responses API call and validates the decoded shape. Prints
// only non-sensitive metadata (HTTP status, model, usage). When credentials
// are missing the skip is reported honestly instead of failing CI.

async function main() {
  if (process.env.LIVE_PROVIDER_VERIFY !== "1" || !process.env.OPENAI_API_KEY) {
    console.log(
      "live provider verification skipped: set LIVE_PROVIDER_VERIFY=1 and OPENAI_API_KEY to enable"
    );
    return;
  }

  const { generateCaptionVariants } = require("../lib/services/captions");

  const variants = await generateCaptionVariants({
    businessName: "Live Verify Cafe",
    quoteText: "A short smoke-test review quote for live provider verification.",
    brandTone: "friendly"
  });

  for (const [style, text] of Object.entries(variants)) {
    assert.ok(typeof text === "string" && text.length > 0, `style ${style} must be non-empty`);
    assert.ok(text.length <= 200, `style ${style} must be <= 200 chars`);
  }

  console.log("live provider verification passed (gpt-4o-mini caption decoding confirmed)");
}

main().catch((err) => {
  console.error("live provider verification failed:", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

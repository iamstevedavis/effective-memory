import assert from "node:assert/strict";
import { generateCaptionVariants } from "../lib/services/captions";

// Fixture coverage for raw OpenAI Responses API caption decoding (issue #41):
// documented output shapes, multiple output items, empty/malformed content,
// non-2xx responses, and timeouts. No real API key or network required.

const CAPTIONS = {
  friendly: "Cafe Nova made our day ☕",
  premium: "An elevated evening, made memorable at Cafe Nova.",
  playful: "Coffee joy unlocked at Cafe Nova!"
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as Response;
}

function documentedResponse(text: string): Response {
  return jsonResponse({
    id: "resp_fixture",
    object: "response",
    model: "gpt-4o-mini",
    output: [
      {
        id: "msg_fixture",
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text, annotations: [] }]
      }
    ],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 }
  });
}

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalTimeout = process.env.OPENAI_TIMEOUT_MS;

type FetchInit = { signal?: AbortSignal; headers?: Record<string, string> };

function stubFetch(impl: (url: unknown, init: FetchInit) => Promise<Response>) {
  globalThis.fetch = (async (_url: any, init: FetchInit) => impl(_url, init)) as typeof fetch;
}

function restore() {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
  if (originalTimeout === undefined) delete process.env.OPENAI_TIMEOUT_MS;
  else process.env.OPENAI_TIMEOUT_MS = originalTimeout;
}

async function documentedShapeTest() {
  stubFetch(async () => documentedResponse(JSON.stringify(CAPTIONS)));

  const variants = await generateCaptionVariants({
    businessName: "Cafe Nova",
    quoteText: "Amazing coffee and staff"
  });

  assert.deepEqual(variants, CAPTIONS);
}

async function multipleOutputItemsTest() {
  // Non-message output items (e.g. function_call) are documented parts of the
  // output array and must be skipped without failing the decode.
  stubFetch(async () =>
    jsonResponse({
      output: [
        { id: "fc_1", type: "function_call", name: "draft", arguments: "{}" },
        {
          id: "msg_1",
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(CAPTIONS) }]
        }
      ]
    })
  );

  const variants = await generateCaptionVariants({
    businessName: "Cafe Nova",
    quoteText: "Amazing coffee and staff"
  });

  assert.deepEqual(variants, CAPTIONS);
}

async function fencedJsonTest() {
  stubFetch(async () => documentedResponse("```json\n" + JSON.stringify(CAPTIONS) + "\n```"));

  const variants = await generateCaptionVariants({
    businessName: "Cafe Nova",
    quoteText: "Amazing coffee and staff"
  });

  assert.deepEqual(variants, CAPTIONS);
}

async function emptyOutputArrayTest() {
  stubFetch(async () => jsonResponse({ output: [] }));

  await assert.rejects(
    () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" }),
    /no text content/
  );
}

async function emptyContentArrayTest() {
  stubFetch(async () =>
    jsonResponse({
      output: [{ id: "msg_1", type: "message", content: [] }]
    })
  );

  await assert.rejects(
    () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" }),
    /no text content/
  );
}

async function missingOutputArrayTest() {
  stubFetch(async () => jsonResponse({ id: "resp_fixture" }));

  await assert.rejects(
    () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" }),
    /missing the output array/
  );
}

async function providerErrorIsRedactedTest() {
  const secretPrompt = "CUSTOMER_REVIEW_RAW_TEXT_THAT_MUST_NEVER_BE_LOGGED";
  stubFetch(async () =>
    jsonResponse(
      { error: { message: `request failed: ${secretPrompt}`, code: "rate_limit_exceeded" } },
      429
    )
  );

  await assert.rejects(
    () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: secretPrompt }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /HTTP 429 \(rate_limit_exceeded\)/);
      assert.doesNotMatch(err.message, /CUSTOMER_REVIEW_RAW_TEXT/);
      return true;
    }
  );
}

async function timeoutTest() {
  process.env.OPENAI_TIMEOUT_MS = "50";
  // Mirror undici: reject with AbortError once the timeout signal fires.
  stubFetch((_url, init) => {
    const signal = init.signal ?? new AbortController().signal;
    return new Promise<Response>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("The operation was aborted.", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  });

  // AbortSignal.timeout uses an unref'd timer; keep the loop alive so it can fire.
  const keepAlive = new Promise<void>((resolve) => setTimeout(resolve, 500));
  await assert.rejects(
    () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" }),
    /timed out after 50ms/
  );
  await keepAlive;
}

async function missingApiKeyTest() {
  delete process.env.OPENAI_API_KEY;
  stubFetch(async () => documentedResponse(JSON.stringify(CAPTIONS)));

  try {
    await assert.rejects(
      () => generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" }),
      /OPENAI_API_KEY is not set/
    );
  } finally {
    process.env.OPENAI_API_KEY = "sk-test-fixture";
  }
}

async function authorizationHeaderTest() {
  stubFetch(async (_url, init) => {
    const headers = init.headers as Record<string, string>;
    assert.equal(headers.authorization, `Bearer ${process.env.OPENAI_API_KEY}`);
    return documentedResponse(JSON.stringify(CAPTIONS));
  });

  await generateCaptionVariants({ businessName: "Cafe Nova", quoteText: "Amazing coffee" });
}

async function main() {
  process.env.OPENAI_API_KEY = "sk-test-fixture";

  try {
    await documentedShapeTest();
    await multipleOutputItemsTest();
    await fencedJsonTest();
    await emptyOutputArrayTest();
    await emptyContentArrayTest();
    await missingOutputArrayTest();
    await providerErrorIsRedactedTest();
    await timeoutTest();
    await missingApiKeyTest();
    await authorizationHeaderTest();
  } finally {
    restore();
  }

  console.log("caption decoding tests passed");
}

main().catch((err) => {
  restore();
  console.error(err instanceof Error ? err.stack : String(err));
  process.exitCode = 1;
});

import { databaseFixture } from "./db-fixture";
import assert from "node:assert/strict";
import { quoteOptions, validBrandConfig, parseBrandColors } from "../lib/branding";
import { renderQuoteCard } from "../lib/services/imageRenderer";
const boundary = require("../lib/authorization");
boundary.ownerRoute = (handler: unknown) => handler;
boundary.currentOwner = () => "synthetic-owner";
const { POST } = require("../app/api/branding/preview/route");
import { NextRequest } from "next/server";
async function main() {
  assert.deepEqual(quoteOptions(undefined), { template: "quote-card-v1", quoteSize: "standard" });
  assert.throws(() => quoteOptions({ template: "unknown" }));
  assert.throws(() => quoteOptions({ quoteSize: "tiny" }));
  assert.equal(validBrandConfig({ primary: "not-a-color" }), false);
  assert.equal(validBrandConfig([]), false);
  const config = parseBrandColors({ primary: " ffffff ", secondary: "000000", quoteSize: "large" });
  assert.equal(config.primary, "#ffffff"); assert.equal(config.quoteSize, "large");
  const reloaded = JSON.parse(JSON.stringify(config));
  const args = { draftPostId: 0, businessName: "Synthetic", quoteText: "Thoughtful service", templateConfig: reloaded };
  assert.deepEqual(await renderQuoteCard(args), await renderQuoteCard({ ...args, templateConfig: config }));
  const request = (body: unknown) => new NextRequest("http://localhost/api/branding/preview", { method: "POST", body: JSON.stringify(body) });
  const preview = await POST(request({ brandColors: config }));
  assert.equal(preview.status, 200); assert.equal(preview.headers.get("content-type"), "image/png");
  assert.equal((await POST(request({ brandColors: { template: "wrong" } }))).status, 400);
  await databaseFixture(async client => {
    const row = (await client.query("SELECT brand_colors FROM businesses WHERE name='Synthetic migration fixture'")).rows[0];
    assert.equal(row.brand_colors.primary, "#abcdef"); assert.equal(row.brand_colors.template, "quote-card-v1");
    await client.query("UPDATE businesses SET brand_colors = brand_colors || $1::jsonb", [JSON.stringify(config)]);
    const saved = (await client.query("SELECT brand_colors FROM businesses LIMIT 1")).rows[0].brand_colors;
    assert.equal(saved.quoteSize, "large"); assert.equal(saved.template, "quote-card-v1");
  }, async (name, client) => {
    if (name === "005_quote_template.sql") await client.query("INSERT INTO businesses(name,timezone,brand_colors) VALUES('Synthetic migration fixture','UTC','{\"primary\":\"#abcdef\"}')");
  });
  console.log("template default/validation/persistence/render/preview tests passed");
}
main().catch(err => { console.error(err); process.exitCode = 1; });

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression coverage for the issue-48 tooling baseline: real lint, declared
// sharp, pinned Node baseline, documented env URLs, and a production web
// image that never quietly runs `next dev`.
const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const pkg = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  engines?: { node?: string };
};

assert.equal(pkg.scripts.lint, "eslint .", "lint must run ESLint, not a placeholder");
assert.ok(pkg.scripts.worker, "worker execution must be a first-class npm script");
assert.ok(pkg.dependencies?.sharp, "sharp must be a declared runtime dependency");
assert.ok(pkg.engines?.node, "engines.node must declare the Node baseline");

const nodeMajor = /\d+/.exec(pkg.engines.node)?.[0] ?? "";
assert.equal(read(".nvmrc").trim(), nodeMajor, ".nvmrc must match engines.node major");

const envExample = read(".env.example");
assert.match(envExample, /@localhost:5432/, ".env.example must document the host DATABASE_URL");
assert.match(envExample, /@postgres:5432/, ".env.example must document the container DATABASE_URL");

assert.doesNotMatch(
  read("Dockerfile.web"),
  /CMD \["npm", "run", "dev"\]/,
  "production web image must not run next dev"
);

console.log("tooling regression tests passed");

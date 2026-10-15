import { readFileSync } from "node:fs";
import { pilotReport, PilotBusiness } from "../lib/pilot";

const [path, ids, start, end] = process.argv.slice(2);
if (!path || !ids || !start || !end) {
  throw new Error("Usage: npm run pilot:report -- ledger.json business-id[,business-id] start-UTC end-UTC");
}
// No server endpoint or DB access. The operator obtains owner consent first.
let ledger: PilotBusiness[];
try {
  ledger = JSON.parse(readFileSync(path, "utf8")) as PilotBusiness[];
} catch {
  throw new Error("Cannot read ledger JSON; check the private file locally (contents omitted)");
}
console.log(JSON.stringify(pilotReport(ledger, ids.split(","), start, end), null, 2));

import { query, pool } from "../lib/db";
async function main() {
  const [business, owner] = process.argv.slice(2);
  if (!Number.isSafeInteger(Number(business)) || Number(business) <= 0 || !owner) throw new Error("Usage: npm run business:claim -- BUSINESS_ID VERIFIED_AUTH_USER_ID");
  const result = await query("UPDATE businesses SET owner_id=$2 WHERE id=$1 AND owner_id IS NULL AND EXISTS(SELECT 1 FROM auth_users WHERE id=$2) RETURNING id", [business,owner]);
  if (!result.rowCount) throw new Error("Claim refused: business already assigned, missing business, or missing owner");
  console.log("Explicit business claim completed");
}
main().catch(()=>{console.error("Claim failed; verify IDs and existing assignment privately");process.exitCode=1;}).finally(()=>pool.end());

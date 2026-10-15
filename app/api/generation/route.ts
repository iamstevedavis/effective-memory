import { NextResponse } from "next/server";
import { ownerRoute } from "../../../lib/authorization";
import { query } from "../../../lib/db";
export const GET = ownerRoute(async req => {
  const id = req.nextUrl.searchParams.get("businessId");
  const jobs = await query("SELECT id,draft_id,state,attempts,manual_retries,next_at,error_code,period_start::text FROM generation_jobs WHERE business_id=$1 ORDER BY id DESC LIMIT 50",[id]);
  const periods = await query("SELECT period_start::text,target,allocated,completed,reason,timezone FROM generation_periods WHERE business_id=$1 ORDER BY period_start DESC LIMIT 2",[id]);
  return NextResponse.json({jobs:jobs.rows,periods:periods.rows});
});

// Manual, owner-authorized observations only; never ingest review/caption text.
export type PilotEvent = {
  type: "onboarding_start" | "draft_complete" | "session_start" | "session_end" |
    "approved" | "scheduled" | "published" | "returned" | "generation_cost";
  at: string;
  id?: string; // draft ID, session ID, or unique provider usage receipt ID
  unedited?: boolean;
  usd?: number;
};
export type PilotBusiness = { id: string; synthetic: boolean; events: PilotEvent[] };
const types = new Set(["onboarding_start", "draft_complete", "session_start", "session_end",
  "approved", "scheduled", "published", "returned", "generation_cost"]);
const week = 7 * 86400000;
function time(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== value) {
    throw new Error("Use valid UTC ISO timestamps with milliseconds");
  }
  return ms;
}

export function pilotReport(businesses: PilotBusiness[], authorized: string[], start: string, end: string) {
  const from = time(start), until = time(end);
  if (until <= from || !authorized.length) throw new Error("Require a positive window and authorized business IDs");
  if (!Array.isArray(businesses) || businesses.some(b => !b || typeof b.id !== "string" ||
    typeof b.synthetic !== "boolean" || !Array.isArray(b.events))) throw new Error("Invalid business ledger");
  const ids = businesses.map(b => b.id);
  if (new Set(ids).size !== ids.length || authorized.some(id => !ids.includes(id))) {
    throw new Error("Business IDs must be unique and authorized IDs must exist");
  }
  return businesses.filter(b => authorized.includes(b.id) && b.synthetic === false).map(b => {
    const events = b.events.map(e => {
      if (!e || typeof e.at !== "string" || e.id !== undefined && typeof e.id !== "string") {
        throw new Error("Invalid observation timestamp or ID");
      }
      const at = time(e.at);
      if (!types.has(e.type) || (e.type.startsWith("session_") ||
        ["approved", "scheduled", "published", "generation_cost"].includes(e.type)) && !e.id) {
        throw new Error("Unknown event type or missing observation ID");
      }
      if (e.unedited !== undefined && typeof e.unedited !== "boolean" ||
        e.type === "generation_cost" && (!Number.isFinite(e.usd) || e.usd! < 0)) {
        throw new Error("Invalid approval flag or generation cost");
      }
      return { ...e, ms: at };
    }).sort((a, z) => a.ms - z.ms);
    const inside = events.filter(e => e.ms >= from && e.ms < until);
    const unique = (type: string) => {
      const rows = events.filter(e => e.type === type);
      if (new Set(rows.map(e => e.id)).size !== rows.length) {
        throw new Error("Duplicate observation ID within event type; reconcile the ledger");
      }
      return rows.filter(e => e.ms >= from && e.ms < until);
    };
    const onboarding = events.find(e => e.type === "onboarding_start" && e.ms < until);
    const first = onboarding && events.find(e => e.type === "draft_complete" && e.ms >= onboarding.ms && e.ms < until);
    const approvals = unique("approved"), costs = unique("generation_cost");
    const known = approvals.filter(e => e.unedited !== undefined);
    const unedited = known.filter(e => e.unedited).length;
    const starts = unique("session_start"), ends = unique("session_end");
    const sessions = starts.map(s => {
      const finish = ends.find(e => e.id === s.id && e.ms >= s.ms);
      return { id: s.id, startedAt: s.at, minutes: finish ? (finish.ms - s.ms) / 60000 : null };
    });
    const secondWeek = onboarding && onboarding.ms + week;
    const observedSecondWeek = secondWeek !== undefined && from <= secondWeek && until >= secondWeek + week;
    const returned = secondWeek !== undefined && inside.some(e => e.type === "returned" && e.ms >= secondWeek && e.ms < secondWeek + week);
    return {
      businessId: b.id, start, end,
      firstDraftMinutes: first && onboarding && onboarding.ms >= from ? (first.ms - onboarding.ms) / 60000 : null,
      approved: approvals.length, approvalEditStatusKnown: known.length, approvedWithoutEdits: unedited,
      approvedWithoutEditsRate: approvals.length && known.length === approvals.length ? unedited / approvals.length : null,
      sessions, unmatchedSessionEnds: ends.filter(e => !starts.some(s => s.id === e.id && s.ms <= e.ms)).length,
      scheduled: unique("scheduled").length, published: unique("published").length,
      returnedInWeekTwo: returned ? true : observedSecondWeek ? false : null,
      generationCostUsd: costs.length ? Number(costs.reduce((sum, e) => sum + e.usd!, 0).toFixed(6)) : null,
      costReceiptCount: costs.length
    };
  });
}

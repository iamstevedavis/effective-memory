"use client";

import PostingSlots from "./PostingSlots";
import { useEffect, useMemo, useState } from "react";

type Business = { id: number; name: string };
type Draft = {
  id: number; version: number;
  rating?: number; author_name?: string; reviewed_at?: string; source?: string; source_url?: string;
  provider_state?: string; job_state?: string; error_code?: string;
  review_id: number | null;
  quote_text: string;
  caption_text: string;
  image_path: string | null;
  status: string;
  audit_note?: string | null;
  scheduled_for?: string | null;
  created_at: string;
};

function extractHashtags(caption: string) {
  return caption.match(/#[A-Za-z0-9_]+/g) ?? [];
}

function formatScheduledTime(value?: string | null) {
  if (!value) return "(none)";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function PostPreview({ draft, scheduledPreview, onChanged }: { draft: Draft; scheduledPreview?: string | null; onChanged?: () => void }) {
  const hashtags = extractHashtags(draft.caption_text);
  const scheduledTime = scheduledPreview || draft.scheduled_for;

  return (
    <div style={{ marginTop: 8, padding: 10, border: "1px solid #ddd", borderRadius: 6, background: "#fafafa" }}>
      <p>Source: {draft.source ?? "unavailable"} · {draft.rating ?? "?"}★ · {draft.author_name ?? "Anonymous"} · {draft.reviewed_at ? new Date(draft.reviewed_at).toLocaleDateString() : "Date unknown"}</p>
      {draft.source_url ? <a href={draft.source_url} target="_blank" rel="noreferrer">Original review</a> : null}
      <p>Provider: {draft.provider_state ?? "not submitted"}</p>
      <DraftControls draft={draft} onChanged={onChanged} />
      <div style={{ marginBottom: 8 }}>
        <strong>Image:</strong>
        {draft.image_path ? (
          <div style={{ marginTop: 6 }}>
            <img
              src={draft.image_path}
              alt={`Draft ${draft.id} preview`}
              style={{ width: 220, border: "1px solid #ddd", borderRadius: 4 }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 4 }}>(none)</div>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Caption:</strong> {draft.caption_text || "(none)"}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Hashtags:</strong> {hashtags.length ? hashtags.join(" ") : "(none)"}
      </div>

      <div>
        <strong>Scheduled time:</strong> {formatScheduledTime(scheduledTime)}
      </div>
    </div>
  );
}

function DraftControls({draft,onChanged}:{draft:Draft;onChanged?:()=>void}) {
  const [caption,setCaption]=useState(draft.caption_text),[error,setError]=useState("");
  useEffect(()=>setCaption(draft.caption_text),[draft.caption_text]);
  async function run(path:string,extra:Record<string,unknown>={}) {
    const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({draftPostId:draft.id,version:draft.version,...extra})});
    const data=await response.json();setError(response.ok ? data.message ?? "Saved" : data.error ?? "Action failed");onChanged?.();
  }
  if(["scheduled","published","archived"].includes(draft.status))return null;
  return <div><label>Caption for draft {draft.id}<textarea maxLength={200} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
    <button onClick={()=>run("/api/drafts/caption",{captionText:caption})}>Save caption</button>
    <button onClick={()=>run("/api/drafts/status",{status:"archived"})}>Archive</button>
    <button onClick={()=>run("/api/generation/regenerate")}>Regenerate</button>
    {draft.status==="failed" ? <button onClick={()=>run("/api/generation/retry")}>Retry failed job</button> : null}
    <p>Generation: {draft.job_state ?? "not queued"} {draft.error_code ?? ""}</p>{error?<p role="status">{error}</p>:null}</div>;
}

export default function ApprovalPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected,setSelected]=useState<Record<number,boolean>>({});
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [scheduledForByDraft, setScheduledForByDraft] = useState<Record<number, string>>({});

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    setBusinesses(data.businesses ?? []);
  }

  async function loadDrafts(id: string) {
    if (!id) return setDrafts([]);
    const res = await fetch(`/api/drafts?businessId=${id}`);
    const data = await res.json();
    setDrafts(data.drafts ?? []);
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    loadDrafts(businessId);
  }, [businessId]);

  useEffect(()=>{if(!businessId)return;const timer=setInterval(()=>void loadDrafts(businessId),3000);return ()=>clearInterval(timer);},[businessId]);

  const byStatus = useMemo(() => {
    return {
      draft: drafts.filter((d) => d.status === "draft"),
      approved: drafts.filter((d) => d.status === "approved"),
      scheduled: drafts.filter((d) => ["scheduled","published"].includes(d.status)),
      failed: drafts.filter(d=>d.status==="failed")
    };
  }, [drafts]);

  async function updateStatus(draftPostId: number, status: "draft" | "approved") {
    const res = await fetch("/api/drafts/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draftPostId, version: drafts.find(d=>d.id===draftPostId)?.version,
        status,
        auditNote: notes[draftPostId] ?? ""
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Status update failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setMessage(`Draft #${draftPostId} moved to ${status}`);
    await loadDrafts(businessId);
  }

  async function setSchedule(draftPostId: number) {
    const scheduledFor = scheduledForByDraft[draftPostId];
    if (!scheduledFor) {
      setMessage("Please choose a datetime first");
      return;
    }

    const iso = new Date(scheduledFor).toISOString();
    const res = await fetch("/api/drafts/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftPostId, version: drafts.find(d=>d.id===draftPostId)?.version, scheduledFor: iso })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Schedule set failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setMessage(`Scheduled time set for draft #${draftPostId}`);
    await loadDrafts(businessId);
  }

  async function approveSelected() {
    const items=drafts.filter(d=>selected[d.id]).map(d=>({draftPostId:d.id,version:d.version}));
    const response=await fetch("/api/drafts/bulk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({items})});
    const data=await response.json();setMessage(data.results ? data.results.map((r:{draftPostId:number;status:number;error?:string})=>`#${r.draftPostId}: ${r.status===200?"approved":r.error??"failed"}`).join("; ") : data.error);
    setSelected({});await loadDrafts(businessId);
  }
  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 1100 }}>
      <h1>Draft approval queue</h1>

      <section style={{ marginBottom: 16 }}>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          <option value="">Select business…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </section>

      {message ? (
        <p>
          <strong>{message}</strong>
        </p>
      ) : null}

      <button onClick={approveSelected} disabled={!Object.values(selected).some(Boolean)}>Approve selected</button>
      <PostingSlots businessId={businessId} />
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
        <div>
          <h2>Draft</h2>
          <ul>
            {byStatus.draft.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>
                  #{d.id} {d.quote_text}
                </div>
                <label><input type="checkbox" aria-label={`Select draft ${d.id}`} checked={!!selected[d.id]} onChange={e=>setSelected({...selected,[d.id]:e.target.checked})}/>Select</label>
                <input
                  placeholder="audit note (optional)"
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  style={{ width: 260, marginTop: 4 }}
                />
                <div>
                  <button onClick={() => updateStatus(d.id, "approved")} style={{ marginTop: 6 }}>
                    Approve
                  </button>
                </div>
                <PostPreview draft={d} onChanged={()=>loadDrafts(businessId)} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Approved</h2>
          <p>Scheduling requires a verified Buffer connection. No post is submitted until the integration is configured.</p>
          <ul>
            {byStatus.approved.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>
                  #{d.id} {d.quote_text}
                </div>
                <input
                  type="datetime-local"
                  value={scheduledForByDraft[d.id] ?? ""}
                  onChange={(e) =>
                    setScheduledForByDraft((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                  style={{ marginTop: 4 }}
                />
                <div>
                  <button onClick={() => setSchedule(d.id)} style={{ marginTop: 6 }}>
                    Set schedule
                  </button>
                  <button onClick={() => updateStatus(d.id, "draft")} style={{ marginTop: 6, marginLeft: 8 }}>
                    Send back to draft
                  </button>
                </div>
                <PostPreview draft={d} onChanged={()=>loadDrafts(businessId)} scheduledPreview={scheduledForByDraft[d.id]} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Scheduled</h2>
          <ul>
            {byStatus.scheduled.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>
                  #{d.id} {d.quote_text}
                </div>
                <PostPreview draft={d} onChanged={()=>loadDrafts(businessId)} />
              </li>
            ))}
          </ul>
        </div>
        <div><h2>Failed</h2><ul>{byStatus.failed.map(d=><li key={d.id}><PostPreview draft={d} onChanged={()=>loadDrafts(businessId)}/></li>)}</ul></div>
      </section>
    </main>
  );
}

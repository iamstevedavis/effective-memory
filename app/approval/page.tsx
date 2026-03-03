"use client";

import { useEffect, useMemo, useState } from "react";

type Business = { id: number; name: string };
type Draft = {
  id: number;
  review_id: number | null;
  quote_text: string;
  caption_text: string;
  image_path: string | null;
  status: string;
  audit_note?: string | null;
  scheduled_for?: string | null;
  created_at: string;
};

export default function ApprovalPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
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

  const byStatus = useMemo(() => {
    return {
      draft: drafts.filter((d) => d.status === "draft"),
      approved: drafts.filter((d) => d.status === "approved"),
      scheduled: drafts.filter((d) => d.status === "scheduled")
    };
  }, [drafts]);

  async function updateStatus(draftPostId: number, status: "draft" | "approved") {
    const res = await fetch("/api/drafts/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draftPostId,
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
      body: JSON.stringify({ draftPostId, scheduledFor: iso })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Schedule set failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setMessage(`Scheduled time set for draft #${draftPostId}`);
    await loadDrafts(businessId);
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

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <h2>Draft</h2>
          <ul>
            {byStatus.draft.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>#{d.id} {d.quote_text}</div>
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
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Approved</h2>
          <ul>
            {byStatus.approved.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>#{d.id} {d.quote_text}</div>
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
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2>Scheduled</h2>
          <ul>
            {byStatus.scheduled.map((d) => (
              <li key={d.id} style={{ marginBottom: 14 }}>
                <div>#{d.id} {d.quote_text}</div>
                <div>
                  <small>scheduled_for: {d.scheduled_for ?? "(none)"}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

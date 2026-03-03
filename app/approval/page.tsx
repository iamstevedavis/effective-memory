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
  created_at: string;
};

export default function ApprovalPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});

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
      approved: drafts.filter((d) => d.status === "approved")
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

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                  placeholder="audit note (optional)"
                  value={notes[d.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  style={{ width: 260, marginTop: 4 }}
                />
                <div>
                  <button onClick={() => updateStatus(d.id, "draft")} style={{ marginTop: 6 }}>
                    Send back to draft
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

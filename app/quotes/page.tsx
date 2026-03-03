"use client";

import { useEffect, useState } from "react";

type Business = { id: number; name: string };
type Draft = { id: number; review_id: number | null; quote_text: string; status: string };

export default function QuotesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [limit, setLimit] = useState(5);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);

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

  useEffect(() => { loadBusinesses(); }, []);
  useEffect(() => { loadDrafts(businessId); }, [businessId]);

  async function runSelector() {
    if (!businessId) return;
    const res = await fetch("/api/quotes/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: Number(businessId), limit })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Selector failed: ${data.error ?? "unknown error"}`);
      return;
    }
    setMessage(`Inserted ${data.inserted} quote candidates`);
    await loadDrafts(businessId);
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 960 }}>
      <h1>Quote selector v1</h1>
      <p>Deterministic ranking (no AI): rating, length, profanity filter, keywords.</p>

      <section style={{ marginBottom: 16 }}>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          <option value="">Select business…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={25}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 5)}
          style={{ width: 80, marginLeft: 8 }}
        />

        <button onClick={runSelector} disabled={!businessId} style={{ marginLeft: 8 }}>
          Generate candidates
        </button>
      </section>

      {message ? <p><strong>{message}</strong></p> : null}

      <section>
        <h2>Persisted candidates (draft_posts)</h2>
        <ul>
          {drafts.map((d) => (
            <li key={d.id}>#{d.id} [{d.status}] {d.quote_text}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

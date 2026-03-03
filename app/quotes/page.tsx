"use client";

import { useEffect, useState } from "react";

type Business = { id: number; name: string };
type Draft = {
  id: number;
  review_id: number | null;
  quote_text: string;
  caption_text: string;
  status: string;
};
type CaptionSet = { friendly: string; premium: string; playful: string };

export default function QuotesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [limit, setLimit] = useState(5);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [captionVariantsByDraft, setCaptionVariantsByDraft] = useState<Record<number, CaptionSet>>({});
  const [loadingDraftId, setLoadingDraftId] = useState<number | null>(null);

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

  async function generateCaptions(draftPostId: number) {
    setLoadingDraftId(draftPostId);
    try {
      const res = await fetch("/api/captions/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftPostId })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Caption generation failed: ${data.error ?? "unknown error"}`);
        return;
      }
      setCaptionVariantsByDraft((prev) => ({ ...prev, [draftPostId]: data.captions }));
      setMessage(`Generated caption variants for draft #${draftPostId}`);
    } finally {
      setLoadingDraftId(null);
    }
  }

  async function chooseCaption(draftPostId: number, captionText: string) {
    const res = await fetch("/api/drafts/caption", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draftPostId, captionText })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(`Save caption failed: ${data.error ?? "unknown error"}`);
      return;
    }
    setMessage(`Saved caption to draft #${draftPostId}`);
    await loadDrafts(businessId);
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 960 }}>
      <h1>Quote selector + caption generation</h1>
      <p>Deterministic quote ranking + AI caption variants (friendly/premium/playful).</p>

      <section style={{ marginBottom: 16 }}>
        <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
          <option value="">Select business…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
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

      {message ? (
        <p>
          <strong>{message}</strong>
        </p>
      ) : null}

      <section>
        <h2>Persisted draft candidates</h2>
        <ul>
          {drafts.map((d) => {
            const variants = captionVariantsByDraft[d.id];
            return (
              <li key={d.id} style={{ marginBottom: 16 }}>
                <div>
                  #{d.id} [{d.status}] {d.quote_text}
                </div>
                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => generateCaptions(d.id)}
                    disabled={loadingDraftId === d.id}
                  >
                    {loadingDraftId === d.id ? "Generating..." : "Generate captions"}
                  </button>
                </div>

                {variants ? (
                  <ul>
                    {([
                      ["friendly", variants.friendly],
                      ["premium", variants.premium],
                      ["playful", variants.playful]
                    ] as const).map(([style, text]) => (
                      <li key={style} style={{ marginTop: 6 }}>
                        <strong>{style}:</strong> {text}{" "}
                        <button onClick={() => chooseCaption(d.id, text)} style={{ marginLeft: 8 }}>
                          Use this
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {d.caption_text ? (
                  <div style={{ marginTop: 6 }}>
                    <em>Saved caption:</em> {d.caption_text}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

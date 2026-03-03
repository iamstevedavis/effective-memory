"use client";

import { FormEvent, useEffect, useState } from "react";

type Business = { id: number; name: string };
type Review = {
  id: number;
  rating: number;
  author_name: string | null;
  text: string;
  reviewed_at: string;
};

export default function ImportPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [result, setResult] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    setBusinesses(data.businesses ?? []);
  }

  async function loadReviews(businessId: string) {
    if (!businessId) {
      setReviews([]);
      return;
    }
    const res = await fetch(`/api/reviews?businessId=${businessId}`);
    const data = await res.json();
    setReviews(data.reviews ?? []);
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    loadReviews(selectedBusinessId);
  }, [selectedBusinessId]);

  async function createBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newBusinessName.trim();
    if (!name) return;

    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, timezone: "America/Toronto" })
    });
    const data = await res.json();
    if (!res.ok) {
      setResult(`Create business failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setNewBusinessName("");
    await loadBusinesses();
    setSelectedBusinessId(String(data.business.id));
    setResult(`Created business: ${data.business.name}`);
  }

  async function importCsv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("businessId", selectedBusinessId);

    const res = await fetch("/api/reviews/import", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setResult(`Import failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setResult(
      `Imported ${data.imported}, skipped empty ${data.skippedEmpty}, rejected ${data.rejectedInvalid}`
    );

    await loadReviews(selectedBusinessId);
    form.reset();
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 920 }}>
      <h1>Manual review import (CSV)</h1>

      <section style={{ marginBottom: 20 }}>
        <h2>Create business</h2>
        <form onSubmit={createBusiness}>
          <input
            value={newBusinessName}
            onChange={(e) => setNewBusinessName(e.target.value)}
            placeholder="Business name"
          />
          <button type="submit" style={{ marginLeft: 8 }}>
            Create
          </button>
        </form>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2>Select business</h2>
        <select
          value={selectedBusinessId}
          onChange={(e) => setSelectedBusinessId(e.target.value)}
        >
          <option value="">Select…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2>Upload CSV</h2>
        <p>Required columns: rating, text, reviewed_at (ISO). Optional: author_name.</p>
        <form onSubmit={importCsv}>
          <input type="file" name="file" accept=".csv,text/csv" required />
          <button type="submit" disabled={!selectedBusinessId} style={{ marginLeft: 8 }}>
            Import
          </button>
        </form>
      </section>

      {result ? <p><strong>{result}</strong></p> : null}

      <section>
        <h2>Imported reviews (latest 100)</h2>
        <ul>
          {reviews.map((r) => (
            <li key={r.id}>
              <strong>{r.rating}★</strong> {r.author_name ? `(${r.author_name})` : ""} — {r.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

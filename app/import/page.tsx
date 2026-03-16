"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BrandTone = "friendly" | "premium" | "playful";

type Business = {
  id: number;
  name: string;
  logo_url?: string | null;
  brand_tone?: BrandTone;
  brand_colors?: {
    primary?: string;
    secondary?: string;
  };
};

type Review = {
  id: number;
  rating: number;
  author_name: string | null;
  text: string;
  reviewed_at: string;
};

const DEFAULT_PRIMARY = "#1f2937";
const DEFAULT_SECONDARY = "#374151";

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return "";
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

export default function ImportPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [result, setResult] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [brandTone, setBrandTone] = useState<BrandTone>("friendly");

  const selectedBusiness = useMemo(
    () => businesses.find((b) => String(b.id) === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  );

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

  useEffect(() => {
    if (!selectedBusiness) {
      setLogoUrl("");
      setPrimaryColor(DEFAULT_PRIMARY);
      setSecondaryColor(DEFAULT_SECONDARY);
      setBrandTone("friendly");
      return;
    }

    setLogoUrl(selectedBusiness.logo_url ?? "");
    setPrimaryColor(selectedBusiness.brand_colors?.primary ?? DEFAULT_PRIMARY);
    setSecondaryColor(selectedBusiness.brand_colors?.secondary ?? DEFAULT_SECONDARY);
    setBrandTone(selectedBusiness.brand_tone ?? "friendly");
  }, [selectedBusiness]);

  async function createBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newBusinessName.trim();
    if (!name) return;

    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        timezone: "America/Toronto",
        logoUrl,
        primaryColor: normalizeHex(primaryColor) || DEFAULT_PRIMARY,
        secondaryColor: normalizeHex(secondaryColor) || DEFAULT_SECONDARY,
        brandTone
      })
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

  async function saveBranding(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBusinessId) return;

    const normalizedPrimary = normalizeHex(primaryColor);
    const normalizedSecondary = normalizeHex(secondaryColor);
    if (!normalizedPrimary || !normalizedSecondary) {
      setResult("Branding save failed: colors must be valid hex (e.g. #1f2937)");
      return;
    }

    const res = await fetch(`/api/businesses/${selectedBusinessId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        logoUrl: logoUrl.trim(),
        primaryColor: normalizedPrimary,
        secondaryColor: normalizedSecondary,
        brandTone
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setResult(`Branding save failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setResult(`Saved branding for ${data.business.name}`);
    await loadBusinesses();
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
        <h2>Branding settings</h2>
        <p>Logo + colors + tone are used for captions and rendered image templates.</p>
        <form onSubmit={saveBranding}>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label>
              Logo URL
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <label>
              Primary color
              <input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#1f2937"
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <label>
              Secondary color
              <input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#374151"
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <label>
              Brand tone
              <select
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value as BrandTone)}
                style={{ display: "block", width: "100%" }}
              >
                <option value="friendly">friendly</option>
                <option value="premium">premium</option>
                <option value="playful">playful</option>
              </select>
            </label>
          </div>

          <button type="submit" disabled={!selectedBusinessId} style={{ marginTop: 10 }}>
            Save branding
          </button>
        </form>
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

      {result ? (
        <p>
          <strong>{result}</strong>
        </p>
      ) : null}

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

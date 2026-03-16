"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type BrandTone = "friendly" | "premium" | "playful";

type Business = {
  id: number;
  name: string;
  timezone: string;
  brand_colors: { primary?: string; secondary?: string } | null;
  logo_url: string | null;
  brand_tone: BrandTone;
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

export default function ImportPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessLogoUrl, setNewBusinessLogoUrl] = useState("");
  const [newBusinessPrimaryColor, setNewBusinessPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [newBusinessSecondaryColor, setNewBusinessSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [newBusinessTone, setNewBusinessTone] = useState<BrandTone>("friendly");

  const [settingsName, setSettingsName] = useState("");
  const [settingsTimezone, setSettingsTimezone] = useState("America/Toronto");
  const [settingsLogoUrl, setSettingsLogoUrl] = useState("");
  const [settingsPrimaryColor, setSettingsPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [settingsSecondaryColor, setSettingsSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [settingsTone, setSettingsTone] = useState<BrandTone>("friendly");

  const [result, setResult] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);

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
      setSettingsName("");
      setSettingsTimezone("America/Toronto");
      setSettingsLogoUrl("");
      setSettingsPrimaryColor(DEFAULT_PRIMARY);
      setSettingsSecondaryColor(DEFAULT_SECONDARY);
      setSettingsTone("friendly");
      return;
    }

    setSettingsName(selectedBusiness.name);
    setSettingsTimezone(selectedBusiness.timezone || "America/Toronto");
    setSettingsLogoUrl(selectedBusiness.logo_url ?? "");
    setSettingsPrimaryColor(selectedBusiness.brand_colors?.primary ?? DEFAULT_PRIMARY);
    setSettingsSecondaryColor(selectedBusiness.brand_colors?.secondary ?? DEFAULT_SECONDARY);
    setSettingsTone(selectedBusiness.brand_tone ?? "friendly");
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
        logoUrl: newBusinessLogoUrl.trim() || null,
        brandColors: {
          primary: newBusinessPrimaryColor,
          secondary: newBusinessSecondaryColor
        },
        brandTone: newBusinessTone
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setResult(`Create business failed: ${data.error ?? "unknown error"}`);
      return;
    }

    setNewBusinessName("");
    setNewBusinessLogoUrl("");
    setNewBusinessPrimaryColor(DEFAULT_PRIMARY);
    setNewBusinessSecondaryColor(DEFAULT_SECONDARY);
    setNewBusinessTone("friendly");

    await loadBusinesses();
    setSelectedBusinessId(String(data.business.id));
    setResult(`Created business: ${data.business.name}`);
  }

  async function saveBrandingSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedBusinessId) return;

    const res = await fetch(`/api/businesses/${selectedBusinessId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: settingsName,
        timezone: settingsTimezone,
        logoUrl: settingsLogoUrl.trim() || null,
        brandColors: {
          primary: settingsPrimaryColor,
          secondary: settingsSecondaryColor
        },
        brandTone: settingsTone
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setResult(`Update branding failed: ${data.error ?? "unknown error"}`);
      return;
    }

    await loadBusinesses();
    setResult(`Saved branding settings for: ${data.business.name}`);
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
        <form onSubmit={createBusiness} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <input
            value={newBusinessName}
            onChange={(e) => setNewBusinessName(e.target.value)}
            placeholder="Business name"
          />
          <input
            value={newBusinessLogoUrl}
            onChange={(e) => setNewBusinessLogoUrl(e.target.value)}
            placeholder="Logo URL (optional)"
          />
          <label>
            Primary color{" "}
            <input
              type="color"
              value={newBusinessPrimaryColor}
              onChange={(e) => setNewBusinessPrimaryColor(e.target.value)}
            />
          </label>
          <label>
            Secondary color{" "}
            <input
              type="color"
              value={newBusinessSecondaryColor}
              onChange={(e) => setNewBusinessSecondaryColor(e.target.value)}
            />
          </label>
          <label>
            Brand tone{" "}
            <select
              value={newBusinessTone}
              onChange={(e) => setNewBusinessTone(e.target.value as BrandTone)}
            >
              <option value="friendly">friendly</option>
              <option value="premium">premium</option>
              <option value="playful">playful</option>
            </select>
          </label>
          <button type="submit" style={{ width: "fit-content" }}>
            Create
          </button>
        </form>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2>Select business</h2>
        <select value={selectedBusinessId} onChange={(e) => setSelectedBusinessId(e.target.value)}>
          <option value="">Select…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </section>

      {selectedBusinessId ? (
        <section style={{ marginBottom: 20 }}>
          <h2>Branding settings</h2>
          <form onSubmit={saveBrandingSettings} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              placeholder="Business name"
            />
            <input
              value={settingsTimezone}
              onChange={(e) => setSettingsTimezone(e.target.value)}
              placeholder="Timezone"
            />
            <input
              value={settingsLogoUrl}
              onChange={(e) => setSettingsLogoUrl(e.target.value)}
              placeholder="Logo URL"
            />
            <label>
              Primary color{" "}
              <input
                type="color"
                value={settingsPrimaryColor}
                onChange={(e) => setSettingsPrimaryColor(e.target.value)}
              />
            </label>
            <label>
              Secondary color{" "}
              <input
                type="color"
                value={settingsSecondaryColor}
                onChange={(e) => setSettingsSecondaryColor(e.target.value)}
              />
            </label>
            <label>
              Brand tone{" "}
              <select value={settingsTone} onChange={(e) => setSettingsTone(e.target.value as BrandTone)}>
                <option value="friendly">friendly</option>
                <option value="premium">premium</option>
                <option value="playful">playful</option>
              </select>
            </label>
            <button type="submit" style={{ width: "fit-content" }}>
              Save branding settings
            </button>
          </form>
        </section>
      ) : null}

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

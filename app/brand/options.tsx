"use client";
// Shared by the Brand page and onboarding so both offer the same choices.

export type BrandTone = "friendly" | "premium" | "playful";

export const tones: [BrandTone, string][] = [["friendly", "Warm & friendly"], ["premium", "Polished"], ["playful", "Playful"]];

export const swatches: [string, string][] = [
  ["#5b2a44", "Plum"], ["#1f3b5c", "Navy"], ["#2f5d3a", "Forest"], ["#f2e3c8", "Wheat"], ["#c8452c", "Tomato"], ["#1f2937", "Charcoal"]
];

export function timezones(current: string) {
  let zones: string[] = [];
  try { zones = Intl.supportedValuesOf("timeZone"); } catch { /* older browsers: fall back to the current value */ }
  return zones.includes(current) ? zones : [current, ...zones];
}

export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
      <legend style={{ padding: 0, marginBottom: 10, fontSize: 14, fontWeight: 600 }}>{label}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {swatches.map(([hex, name]) => {
          const selected = value.toLowerCase() === hex;
          return (
            <button key={hex} type="button" aria-label={name} aria-pressed={selected} onClick={() => onChange(hex)}
              style={{ width: 44, height: 44, borderRadius: "50%", cursor: "pointer", background: hex, border: selected ? "3px solid #FFFFFF" : "1px solid var(--pl-line)", outline: selected ? "2px solid var(--pl-ink)" : "none" }} />
          );
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }} className="pl-muted">
          Custom
          <input type="color" aria-label={`${label}: custom color`} value={value} onChange={e => onChange(e.target.value)} style={{ width: 44, height: 44, padding: 2, border: "1px solid var(--pl-field-line)", borderRadius: 10, background: "var(--pl-surface)" }} />
        </label>
      </div>
    </fieldset>
  );
}

export function TonePicker({ value, onChange, name }: { value: string; onChange: (value: BrandTone) => void; name: string }) {
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
      <legend style={{ padding: 0, marginBottom: 10, fontSize: 14, fontWeight: 600 }}>How should captions sound?</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {tones.map(([tone, label]) => (
          <label key={tone} className="pl-chip">
            <input type="radio" name={name} value={tone} checked={value === tone} onChange={() => onChange(tone)} />{label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function readLogo(file: File | undefined, done: (dataUrl: string) => void, fail: (message: string) => void) {
  if (!file) return;
  if (file.size > 256000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { fail("Choose a PNG, JPEG or WebP logo under 256 KB"); return; }
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result));
  reader.onerror = () => fail("That logo couldn’t be read");
  reader.readAsDataURL(file);
}

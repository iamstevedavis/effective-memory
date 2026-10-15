export const BRAND_TONES = ["friendly", "premium", "playful"] as const;
export type BrandTone = (typeof BRAND_TONES)[number];

export function isBrandTone(value: unknown): value is BrandTone {
  return typeof value === "string" && BRAND_TONES.includes(value as BrandTone);
}

function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

export function parseBrandColors(input: unknown): Record<string, string> {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};

  const primary = normalizeHex(source.primary);
  const secondary = normalizeHex(source.secondary);

  const brandColors: Record<string, string> = {};
  if (primary) brandColors.primary = primary;
  if (secondary) brandColors.secondary = secondary;
  return { ...brandColors, ...quoteOptions(input) };
}

export function parseLogoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed || null;
}

export const QUOTE_TEMPLATE = "quote-card-v1";
export type QuoteOptions = { template: typeof QUOTE_TEMPLATE; quoteSize: "standard" | "large" };
export function quoteOptions(value: unknown): QuoteOptions {
  const v = (value ?? {}) as Record<string, unknown>;
  if (v.template !== undefined && v.template !== QUOTE_TEMPLATE ||
      v.quoteSize !== undefined && !["standard", "large"].includes(String(v.quoteSize))) {
    throw new Error("Unsupported quote template or text size");
  }
  return { template: QUOTE_TEMPLATE, quoteSize: v.quoteSize === "large" ? "large" : "standard" };
}
export function validBrandConfig(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  try { quoteOptions(v); } catch { return false; }
  return ["primary", "secondary"].every(key => v[key] === undefined || normalizeHex(v[key]) !== null);
}

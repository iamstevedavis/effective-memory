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
  return brandColors;
}

export function parseLogoUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed || null;
}

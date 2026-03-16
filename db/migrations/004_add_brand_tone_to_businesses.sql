ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS brand_tone TEXT NOT NULL DEFAULT 'friendly'
  CHECK (brand_tone IN ('friendly', 'premium', 'playful'));

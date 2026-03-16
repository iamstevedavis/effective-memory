ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS brand_tone TEXT NOT NULL DEFAULT 'friendly';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'businesses_brand_tone_check'
  ) THEN
    ALTER TABLE businesses
    ADD CONSTRAINT businesses_brand_tone_check
    CHECK (brand_tone IN ('friendly', 'premium', 'playful'));
  END IF;
END
$$;

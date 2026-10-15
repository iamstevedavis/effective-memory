-- Add defaults without replacing existing brand choices or touching draft assets.
UPDATE businesses SET brand_colors = '{"template":"quote-card-v1","quoteSize":"standard"}'::jsonb || brand_colors;

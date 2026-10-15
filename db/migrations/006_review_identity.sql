-- No duplicate row is deleted: draft references and original review wording survive.
CREATE FUNCTION review_identity(source_id text, rating integer, author text, body text, reviewed timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN nullif(btrim(source_id),'') IS NOT NULL THEN 'id:' || btrim(source_id)
 ELSE 'fp:' || md5(jsonb_build_array(rating,
   lower(regexp_replace(btrim(normalize(coalesce(author,''), NFKC)), '\s+', ' ', 'g')),
   lower(regexp_replace(btrim(normalize(body, NFKC)), '\s+', ' ', 'g')),
   floor(extract(epoch FROM reviewed) * 1000))::text) END
$$;
ALTER TABLE reviews ADD COLUMN source_url text, ADD COLUMN identity_key text, ADD COLUMN duplicate_of bigint REFERENCES reviews(id);
UPDATE reviews SET identity_key = review_identity(source_review_id, rating, author_name, text, reviewed_at);
WITH groups AS (
 SELECT id, min(id) OVER (PARTITION BY business_id,source,identity_key) canonical FROM reviews
)
UPDATE reviews r SET duplicate_of = g.canonical, identity_key = 'legacy:' || r.id
 FROM groups g WHERE r.id = g.id AND g.id <> g.canonical;
ALTER TABLE reviews ALTER COLUMN identity_key SET NOT NULL;
CREATE UNIQUE INDEX reviews_identity ON reviews(business_id, source, identity_key);
CREATE FUNCTION set_review_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.identity_key := review_identity(NEW.source_review_id, NEW.rating, NEW.author_name, NEW.text, NEW.reviewed_at);
 RETURN NEW;
END $$;
CREATE TRIGGER reviews_identity_insert BEFORE INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION set_review_identity();

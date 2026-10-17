ALTER TABLE businesses ADD COLUMN posting_slots jsonb NOT NULL DEFAULT '[{"weekday":2,"time":"10:00"},{"weekday":4,"time":"10:00"},{"weekday":6,"time":"10:00"}]';
CREATE TABLE posting_slot_claims (
 business_id bigint REFERENCES businesses(id) ON DELETE CASCADE,instant timestamptz NOT NULL,
 draft_id bigint UNIQUE NOT NULL REFERENCES draft_posts(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','confirmed','unknown')),external_id text,
 PRIMARY KEY(business_id,instant)
);

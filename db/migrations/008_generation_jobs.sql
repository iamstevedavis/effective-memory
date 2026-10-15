ALTER TABLE businesses ADD COLUMN weekly_target integer NOT NULL DEFAULT 3 CHECK(weekly_target BETWEEN 1 AND 5);
ALTER TABLE draft_posts ADD COLUMN duplicate_of bigint REFERENCES draft_posts(id);
WITH duplicates AS (SELECT id,min(id) OVER(PARTITION BY review_id) canonical FROM draft_posts WHERE review_id IS NOT NULL)
UPDATE draft_posts d SET duplicate_of=x.canonical FROM duplicates x WHERE d.id=x.id AND x.id<>x.canonical;
CREATE UNIQUE INDEX draft_review_once ON draft_posts(review_id) WHERE duplicate_of IS NULL AND review_id IS NOT NULL;
CREATE TABLE generation_periods (
 business_id bigint REFERENCES businesses(id) ON DELETE CASCADE, period_start date, timezone text NOT NULL,
 target integer NOT NULL CHECK(target BETWEEN 1 AND 5), allocated integer NOT NULL, completed integer NOT NULL,
 reason text NOT NULL DEFAULT 'pending', PRIMARY KEY(business_id,period_start)
);
CREATE TABLE generation_jobs (
 id bigserial PRIMARY KEY, business_id bigint NOT NULL, period_start date NOT NULL,
 draft_id bigint NOT NULL UNIQUE REFERENCES draft_posts(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','retry','complete','failed')),
 attempts integer NOT NULL DEFAULT 0, manual_retries integer NOT NULL DEFAULT 0,
 next_at timestamptz NOT NULL DEFAULT now(), lease text, lease_until timestamptz, error_code text,
 FOREIGN KEY(business_id,period_start) REFERENCES generation_periods(business_id,period_start) ON DELETE CASCADE
);
CREATE INDEX generation_work ON generation_jobs(state,next_at);

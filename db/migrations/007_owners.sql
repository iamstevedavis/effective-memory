CREATE TABLE auth_users (id text PRIMARY KEY, name text, email text UNIQUE, "emailVerified" timestamptz, image text);
CREATE TABLE auth_accounts (provider text NOT NULL, provider_account_id text NOT NULL, owner_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE, PRIMARY KEY(provider,provider_account_id));
CREATE TABLE auth_sessions (token_hash text PRIMARY KEY, owner_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE, expires timestamptz NOT NULL);
ALTER TABLE businesses ADD COLUMN owner_id text REFERENCES auth_users(id);
CREATE INDEX businesses_owner ON businesses(owner_id);
CREATE TABLE owner_usage (owner_id text REFERENCES auth_users(id) ON DELETE CASCADE, day date NOT NULL, kind text NOT NULL, calls integer NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,day,kind));
-- Existing businesses deliberately remain unclaimed until an operator verifies ownership.
UPDATE draft_posts SET image_path=replace(image_path,'/generated/','/api/media/') WHERE image_path LIKE '/generated/%';
CREATE UNIQUE INDEX reviews_business_id_pair ON reviews(business_id,id);
ALTER TABLE draft_posts ADD CONSTRAINT draft_review_business FOREIGN KEY(business_id,review_id) REFERENCES reviews(business_id,id) ON DELETE SET NULL (review_id) NOT VALID;

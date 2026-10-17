ALTER TABLE businesses ADD COLUMN onboarding_key text;
CREATE UNIQUE INDEX onboarding_business_once ON businesses(owner_id,onboarding_key) WHERE onboarding_key IS NOT NULL;

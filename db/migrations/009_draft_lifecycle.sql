ALTER TABLE draft_posts DROP CONSTRAINT draft_posts_status_check;
ALTER TABLE draft_posts ADD CONSTRAINT draft_posts_status_check CHECK(status IN ('draft','approved','scheduled','published','failed','archived'));
ALTER TABLE draft_posts ADD COLUMN version integer NOT NULL DEFAULT 0;
CREATE TABLE draft_events(id bigserial PRIMARY KEY,draft_id bigint NOT NULL REFERENCES draft_posts(id) ON DELETE CASCADE,actor_id text NOT NULL,at timestamptz NOT NULL DEFAULT now(),action text NOT NULL,reason text NOT NULL,from_status text NOT NULL,to_status text NOT NULL);
CREATE FUNCTION draft_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
CREATE TRIGGER draft_revision BEFORE UPDATE ON draft_posts FOR EACH ROW EXECUTE FUNCTION draft_version();
CREATE FUNCTION draft_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO draft_events(draft_id,actor_id,action,reason,from_status,to_status) VALUES(NEW.id,coalesce(nullif(current_setting('app.actor_id',true),''),'worker'),coalesce(nullif(current_setting('app.action',true),''),'updated'),coalesce(nullif(current_setting('app.reason',true),''),'internal_update'),OLD.status,NEW.status);
 RETURN NEW;
END $$;
CREATE TRIGGER draft_audit AFTER UPDATE ON draft_posts FOR EACH ROW EXECUTE FUNCTION draft_history();

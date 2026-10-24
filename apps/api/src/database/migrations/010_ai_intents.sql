CREATE TABLE ai_intents (id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),request jsonb NOT NULL,status text NOT NULL CHECK(status IN ('queued','running','completed','failed')),response jsonb,created_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz);
CREATE INDEX ai_intents_owner ON ai_intents(owner_id,created_at DESC);

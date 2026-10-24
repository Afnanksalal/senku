CREATE TABLE personalized_missions (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), lesson_id text NOT NULL REFERENCES lessons(id), lesson_version text NOT NULL,
 cache_key text NOT NULL, status text NOT NULL CHECK(status IN ('queued','running','completed')),
 request jsonb NOT NULL, specification jsonb NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, UNIQUE(owner_id,lesson_id,cache_key)
);
CREATE INDEX personalized_missions_owner ON personalized_missions(owner_id,created_at DESC);

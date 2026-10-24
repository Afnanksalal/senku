CREATE TABLE dynamic_challenges (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), challenge_id text NOT NULL REFERENCES challenges(id),
 status text NOT NULL CHECK(status IN ('queued','running','completed')), request jsonb NOT NULL,
 specification jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE INDEX dynamic_challenges_owner ON dynamic_challenges(owner_id,created_at DESC);
CREATE TABLE dynamic_challenge_feedback (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), scenario_id uuid NOT NULL REFERENCES dynamic_challenges(id) ON DELETE CASCADE,
 proof_hash text NOT NULL, status text NOT NULL CHECK(status IN ('queued','running','completed')), response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, UNIQUE(owner_id,scenario_id,proof_hash)
);

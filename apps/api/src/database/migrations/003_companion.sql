CREATE TABLE companion_responses (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  request jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','completed','failed')),
  response jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX companion_active_idx ON companion_responses(created_at) WHERE status IN ('queued','running');
CREATE INDEX companion_owner_idx ON companion_responses(owner_id,created_at DESC);

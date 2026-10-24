CREATE TABLE structure_assets (
  source_id text PRIMARY KEY REFERENCES source_records(id),
  object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL,
  byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 4194304),
  content_type text NOT NULL DEFAULT 'chemical/x-mmcif',
  retrieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_resource_sequence_idx ON durable_events(resource_type,resource_id,sequence);
CREATE INDEX runs_pending_idx ON experiment_runs(created_at) WHERE status IN ('queued','running');
CREATE INDEX investigations_pending_idx ON investigations(created_at) WHERE status IN ('queued','running');
CREATE INDEX rewards_owner_created_idx ON learning_rewards(owner_id,created_at);
CREATE INDEX room_members_user_idx ON room_members(user_id,room_id);
CREATE INDEX classroom_members_user_idx ON classroom_members(user_id,classroom_id);
CREATE INDEX assignments_classroom_idx ON assignments(classroom_id,created_at);
CREATE INDEX artifacts_created_idx ON run_artifacts(created_at);

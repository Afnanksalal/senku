CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid text UNIQUE,
  email text UNIQUE,
  password_hash text,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  role text NOT NULL DEFAULT 'learner' CHECK (role IN ('guest','learner','teacher','admin')),
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (email IS NULL OR email = lower(email))
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  access_hash text NOT NULL UNIQUE,
  refresh_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON audit_log(created_at);
CREATE TABLE budget_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  daily_units integer NOT NULL CHECK (daily_units BETWEEN 1 AND 100000),
  member_daily_units integer NOT NULL CHECK (member_daily_units BETWEEN 1 AND 10000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  group_id uuid NOT NULL REFERENCES budget_groups(id),
  created_by uuid NOT NULL REFERENCES users(id),
  max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 10000),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE budget_members (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES budget_groups(id),
  joined_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subjects (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE scientific_models (
  id text NOT NULL,
  version text NOT NULL,
  definition jsonb NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,version)
);
CREATE TABLE experiment_definitions (
  id text NOT NULL,
  version text NOT NULL,
  subject_id text NOT NULL REFERENCES subjects(id),
  model_id text NOT NULL,
  model_version text NOT NULL,
  manifest jsonb NOT NULL,
  content_hash text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,version),
  FOREIGN KEY(model_id,model_version) REFERENCES scientific_models(id,version)
);
CREATE TABLE lessons (
  id text PRIMARY KEY,
  version text NOT NULL,
  subject_id text NOT NULL REFERENCES subjects(id),
  experiment_id text NOT NULL,
  experiment_version text NOT NULL,
  definition jsonb NOT NULL,
  FOREIGN KEY(experiment_id,experiment_version) REFERENCES experiment_definitions(id,version)
);
CREATE TABLE lesson_prerequisites (
  lesson_id text NOT NULL REFERENCES lessons(id),
  prerequisite_id text NOT NULL REFERENCES lessons(id),
  PRIMARY KEY(lesson_id,prerequisite_id),
  CHECK(lesson_id <> prerequisite_id)
);
CREATE TABLE challenges (
  id text PRIMARY KEY,
  lesson_id text NOT NULL REFERENCES lessons(id),
  definition jsonb NOT NULL
);
CREATE TABLE investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  question text NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
  result jsonb,
  error_code text,
  cancel_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX investigations_owner_idx ON investigations(owner_id,created_at DESC,id);
CREATE TABLE agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  role text NOT NULL,
  status text NOT NULL CHECK(status IN ('pending','running','completed','failed','cancelled','skipped')),
  dependencies jsonb NOT NULL DEFAULT '[]',
  output jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE(investigation_id,role)
);
CREATE TABLE simulation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  investigation_id uuid REFERENCES investigations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE experiment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  experiment_id text NOT NULL,
  experiment_version text NOT NULL,
  model_id text NOT NULL,
  model_version text NOT NULL,
  engine_id text NOT NULL,
  adapter_version text NOT NULL,
  engine_version text,
  image_digest text,
  manifest_hash text NOT NULL,
  parameters jsonb NOT NULL,
  seed integer NOT NULL CHECK(seed BETWEEN 0 AND 2147483647),
  status text NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled','timed_out')),
  result jsonb,
  diagnostics jsonb NOT NULL DEFAULT '{}',
  scientific_status text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  error_code text,
  cancel_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  FOREIGN KEY(experiment_id,experiment_version) REFERENCES experiment_definitions(id,version),
  FOREIGN KEY(model_id,model_version) REFERENCES scientific_models(id,version)
);
CREATE INDEX runs_owner_idx ON experiment_runs(owner_id,created_at DESC,id);
CREATE INDEX runs_status_idx ON experiment_runs(status,created_at);
CREATE TABLE simulation_batch_members (
  batch_id uuid NOT NULL REFERENCES simulation_batches(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES experiment_runs(id),
  position integer NOT NULL,
  PRIMARY KEY(batch_id,run_id),
  UNIQUE(batch_id,position)
);
CREATE TABLE usage_reservations (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES budget_groups(id),
  user_id uuid NOT NULL REFERENCES users(id),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  units integer NOT NULL CHECK(units > 0),
  purpose text NOT NULL,
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_group_day_idx ON usage_reservations(group_id,day,state);
CREATE INDEX usage_user_day_idx ON usage_reservations(user_id,day,state);
CREATE TABLE run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content_type text NOT NULL,
  object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL,
  byte_length integer NOT NULL CHECK(byte_length BETWEEN 0 AND 4194304),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE durable_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  owner_id uuid NOT NULL REFERENCES users(id),
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_resource_seq_idx ON durable_events(resource_type,resource_id,sequence);
CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue text NOT NULL CHECK(queue IN ('science','investigations')),
  job_id uuid NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue,job_id)
);
CREATE INDEX outbox_pending_idx ON outbox(available_at) WHERE processed_at IS NULL;
CREATE TABLE idempotency_keys (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  key text NOT NULL CHECK(length(key) BETWEEN 8 AND 128),
  request_hash text NOT NULL,
  response jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,scope,key)
);
CREATE TABLE lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  lesson_id text NOT NULL REFERENCES lessons(id),
  lesson_version text NOT NULL,
  event_id uuid NOT NULL,
  evidence jsonb NOT NULL,
  score double precision NOT NULL CHECK(score BETWEEN 0 AND 1),
  xp integer NOT NULL CHECK(xp BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,event_id)
);
CREATE INDEX lesson_attempt_owner_idx ON lesson_attempts(owner_id,lesson_id);
CREATE TABLE learning_rewards (
  owner_id uuid NOT NULL REFERENCES users(id),
  reward_key text NOT NULL,
  xp integer NOT NULL CHECK(xp BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,reward_key)
);
CREATE TABLE concept_mastery (
  owner_id uuid NOT NULL REFERENCES users(id),
  concept text NOT NULL,
  attempts integer NOT NULL,
  score_sum double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,concept)
);
CREATE TABLE achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  required_lessons integer NOT NULL
);
CREATE TABLE user_achievements (
  owner_id uuid NOT NULL REFERENCES users(id),
  achievement_id text NOT NULL REFERENCES achievements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,achievement_id)
);
CREATE TABLE challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  challenge_id text NOT NULL REFERENCES challenges(id),
  event_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,event_id)
);
CREATE TABLE offline_events (
  owner_id uuid NOT NULL REFERENCES users(id),
  event_id uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(owner_id,event_id)
);
CREATE TABLE pathway_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  graph jsonb NOT NULL,
  sbml text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE source_records (
  id text PRIMARY KEY,
  provider text NOT NULL CHECK(provider IN ('europe-pmc','rcsb-pdb')),
  record jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE investigation_citations (
  investigation_id uuid NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES source_records(id),
  PRIMARY KEY(investigation_id,source_id)
);
CREATE TABLE collaboration_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  experiment_id text NOT NULL,
  experiment_version text NOT NULL,
  parameters jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  last_run_id uuid REFERENCES experiment_runs(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(experiment_id,experiment_version) REFERENCES experiment_definitions(id,version)
);
CREATE TABLE room_members (
  room_id uuid NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  role text NOT NULL CHECK(role IN ('owner','editor','viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(room_id,user_id)
);
CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  resource_type text NOT NULL CHECK(resource_type IN ('run','room','investigation')),
  resource_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('viewer','editor')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(resource_type = 'room' OR role = 'viewer')
);
CREATE TABLE classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  join_code_hash text NOT NULL UNIQUE,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE classroom_members (
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(classroom_id,user_id)
);
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  lesson_id text NOT NULL REFERENCES lessons(id),
  title text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE experiment_runs ADD COLUMN input jsonb NOT NULL DEFAULT '{}';
ALTER TABLE experiment_runs ADD COLUMN room_id uuid REFERENCES collaboration_rooms(id);
CREATE INDEX runs_room_idx ON experiment_runs(room_id) WHERE room_id IS NOT NULL;

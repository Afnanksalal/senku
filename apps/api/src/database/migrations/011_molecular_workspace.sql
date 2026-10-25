CREATE TABLE molecular_collections (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes)<=2000),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX molecular_collections_owner ON molecular_collections(owner_id,updated_at DESC);
CREATE TABLE molecular_compounds (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  collection_id uuid NOT NULL REFERENCES molecular_collections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  smiles text NOT NULL CHECK (char_length(smiles) BETWEEN 1 AND 160),
  canonical_smiles text NOT NULL CHECK (char_length(canonical_smiles) BETWEEN 1 AND 160),
  formula text NOT NULL,
  molblock text CHECK (char_length(molblock)<=128000),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes)<=1000),
  validation_run_id uuid REFERENCES experiment_runs(id) ON DELETE SET NULL,
  validation_manifest_hash text NOT NULL,
  descriptors jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX molecular_compounds_collection ON molecular_compounds(collection_id,created_at,id);
CREATE INDEX molecular_compounds_owner ON molecular_compounds(owner_id);
CREATE TABLE molecular_screens (
  id uuid PRIMARY KEY REFERENCES simulation_batches(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id),
  collection_id uuid REFERENCES molecular_collections(id) ON DELETE SET NULL,
  collection_name text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  settings jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX molecular_screens_owner ON molecular_screens(owner_id,created_at DESC);
CREATE TABLE molecular_screen_members (
  screen_id uuid NOT NULL REFERENCES molecular_screens(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id),
  compound_id uuid REFERENCES molecular_compounds(id) ON DELETE SET NULL,
  compound_name text NOT NULL,
  canonical_smiles text NOT NULL,
  target text NOT NULL CHECK (target IN ('trypsin','streptavidin')),
  position integer NOT NULL CHECK(position BETWEEN 0 AND 7),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(screen_id,run_id),
  UNIQUE(screen_id,position)
);

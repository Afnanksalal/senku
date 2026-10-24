CREATE TABLE learning_preferences (
  owner_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_xp_goal integer NOT NULL DEFAULT 20 CHECK(daily_xp_goal BETWEEN 5 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now()
);

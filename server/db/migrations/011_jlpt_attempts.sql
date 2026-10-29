CREATE TABLE IF NOT EXISTS jlpt_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  level text NOT NULL,
  mode text NOT NULL DEFAULT 'exam' CHECK (mode IN ('exam', 'review')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  exam_snapshot jsonb NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_question integer NOT NULL DEFAULT 0 CHECK (current_question >= 0),
  remaining_seconds integer NOT NULL DEFAULT 0 CHECK (remaining_seconds >= 0),
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS jlpt_attempts_user_level_updated_idx
  ON jlpt_attempts(user_id, level, updated_at DESC);

CREATE INDEX IF NOT EXISTS jlpt_attempts_user_exam_status_idx
  ON jlpt_attempts(user_id, exam_id, status, updated_at DESC);

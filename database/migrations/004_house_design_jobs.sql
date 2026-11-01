-- Background readings of reference images. Images are not stored; only the result is.
CREATE TABLE IF NOT EXISTS house_design_jobs (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status varchar(16) NOT NULL DEFAULT 'queued',
  result jsonb,
  error varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS house_design_jobs_project_id_idx ON house_design_jobs (project_id);

-- One house design document per project: chosen appearance, reference image and saved variations.
-- Kept apart from design_versions so that changing a colour does not add a floor-plan version.
CREATE TABLE IF NOT EXISTS house_designs (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

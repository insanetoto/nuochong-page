CREATE TABLE jobs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued','running','retry_wait','succeeded','failed','cancelled')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
  version integer NOT NULL DEFAULT 1,
  lease_token uuid,
  lease_until timestamptz,
  cancel_requested boolean NOT NULL DEFAULT false,
  error_code text,
  compensation_required boolean NOT NULL DEFAULT false,
  external_pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, idempotency_key),
  CHECK ((status = 'running') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
CREATE INDEX jobs_pending ON jobs (created_at, id) WHERE status IN ('queued','retry_wait');
CREATE TABLE status_history (
  job_id uuid NOT NULL REFERENCES jobs(id),
  version integer NOT NULL,
  status text NOT NULL,
  time timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (job_id, version)
);
CREATE FUNCTION record_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history(job_id, version, status) VALUES (NEW.id, NEW.version, NEW.status);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_status AFTER INSERT OR UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION record_status();
-- Synthetic receiver in the SAME transaction/database. This is not proof for
-- arbitrary remote side effects; uncertain remote writes are compensated.
CREATE TABLE effects (
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL,
  job_id uuid NOT NULL REFERENCES jobs(id),
  payload jsonb NOT NULL,
  PRIMARY KEY (tenant_id, idempotency_key)
);

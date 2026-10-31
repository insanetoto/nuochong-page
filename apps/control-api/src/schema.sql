CREATE TABLE IF NOT EXISTS principals (
 id text PRIMARY KEY, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('user','service')),
 role text NOT NULL CHECK(role IN ('admin','member')), active boolean NOT NULL DEFAULT true,
 epoch integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(kind='user' OR role='member')
);
CREATE TABLE IF NOT EXISTS credentials (
 id text PRIMARY KEY, principal_id text NOT NULL REFERENCES principals(id), token_hash text NOT NULL UNIQUE,
 principal_epoch integer NOT NULL, scopes text[] NOT NULL, expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS sessions (
 id text PRIMARY KEY, owner_id text NOT NULL REFERENCES principals(id), name text NOT NULL,
 native_started boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS runtime_config (
 id integer PRIMARY KEY CHECK(id=1), model text NOT NULL DEFAULT 'deepseek-v4-flash',
 clock_tool boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1
);
INSERT INTO runtime_config(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS runs (
 id text PRIMARY KEY, owner_id text NOT NULL REFERENCES principals(id), credential_id text NOT NULL REFERENCES credentials(id),
 session_id text NOT NULL REFERENCES sessions(id), idempotency_key text NOT NULL, prompt text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry_wait','succeeded','failed','cancelled')),
 cancel_requested boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 attempt integer NOT NULL DEFAULT 0, lease_token text, lease_until timestamptz, dispatched boolean NOT NULL DEFAULT false,
 error_code text, output text, event_seq integer NOT NULL DEFAULT 0,
 config jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(owner_id,idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_session_run ON runs(session_id) WHERE status='running';
CREATE TABLE IF NOT EXISTS events (
 run_id text NOT NULL REFERENCES runs(id), sequence integer NOT NULL, type text NOT NULL,
 text text, time timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(run_id,sequence)
);
CREATE TABLE IF NOT EXISTS audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text, action text NOT NULL,
 resource_id text, result text NOT NULL, time timestamptz NOT NULL DEFAULT clock_timestamp()
);

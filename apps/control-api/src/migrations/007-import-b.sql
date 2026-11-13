-- KBV2-04 107-B: object ownership, persistent import file queues and quota metadata.
CREATE TABLE knowledge_object_bindings(
 hash text NOT NULL REFERENCES knowledge_objects(hash) ON DELETE CASCADE,
 space_id text NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
 filename text NOT NULL CHECK(char_length(filename) BETWEEN 1 AND 256),
 media_type text NOT NULL CHECK(media_type IN ('text/plain','text/markdown','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),
 byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 20971520),
 created_by text NOT NULL REFERENCES principals(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(hash,space_id)
);
CREATE INDEX knowledge_object_bindings_space ON knowledge_object_bindings(space_id,created_at);

ALTER TABLE knowledge_import_batches ADD COLUMN created_credential_id text REFERENCES credentials(id);
ALTER TABLE knowledge_import_files ADD COLUMN title text;
ALTER TABLE knowledge_import_files ADD COLUMN policy_code text;
ALTER TABLE knowledge_import_files ADD COLUMN version text;
ALTER TABLE knowledge_import_files ADD COLUMN media_type text;
ALTER TABLE knowledge_import_files ADD COLUMN sha256 text;
ALTER TABLE knowledge_import_files ADD COLUMN byte_length integer;
ALTER TABLE knowledge_import_files ADD COLUMN valid_from timestamptz;
ALTER TABLE knowledge_import_files ADD COLUMN valid_until timestamptz;
ALTER TABLE knowledge_import_files ADD COLUMN attempt integer NOT NULL DEFAULT 0;
ALTER TABLE knowledge_import_files ADD COLUMN fragment_count integer NOT NULL DEFAULT 0;
ALTER TABLE knowledge_import_files ADD COLUMN extracted_object_hash text REFERENCES knowledge_objects(hash);
ALTER TABLE knowledge_import_files ADD COLUMN cancel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE knowledge_import_files ADD COLUMN lease_token text;
ALTER TABLE knowledge_import_files ADD COLUMN lease_until timestamptz;
ALTER TABLE knowledge_import_files ADD COLUMN deadline_at timestamptz;
CREATE INDEX knowledge_import_file_claim ON knowledge_import_files(status,created_at);
CREATE INDEX knowledge_import_file_running ON knowledge_import_files(space_id,status) WHERE status='parsing';

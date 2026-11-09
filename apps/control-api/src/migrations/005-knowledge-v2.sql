-- KBV2-02 incremental data model. Additive expand-only migration; v0 tables,
-- commands and line/range citations remain readable and unchanged.
ALTER TABLE knowledge_spaces ADD COLUMN code text;
ALTER TABLE knowledge_spaces ADD COLUMN domain_type text NOT NULL DEFAULT 'policy' CHECK(domain_type IN ('policy','procedure','reference'));
ALTER TABLE knowledge_spaces ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','read-only','archived'));
ALTER TABLE knowledge_spaces ADD COLUMN publication_policy_revision integer NOT NULL DEFAULT 1 CHECK(publication_policy_revision>0);
ALTER TABLE knowledge_spaces ADD COLUMN allow_self_publish boolean NOT NULL DEFAULT false;
UPDATE knowledge_spaces SET code='SPACE-'||replace(id,'-','') WHERE code IS NULL;
CREATE UNIQUE INDEX knowledge_space_code ON knowledge_spaces(code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX knowledge_space_id_scope ON knowledge_spaces(id,code);

CREATE TABLE knowledge_space_policy_revisions(
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 revision integer NOT NULL CHECK(revision>0),
 allow_self_publish boolean NOT NULL,
 updated_by text REFERENCES principals(id),
 approval_id text REFERENCES product_approvals(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(space_id,revision)
);
INSERT INTO knowledge_space_policy_revisions(space_id,revision,allow_self_publish,updated_by)
 SELECT id,publication_policy_revision,allow_self_publish,NULL FROM knowledge_spaces;

ALTER TABLE knowledge_pages ADD COLUMN entry_type text NOT NULL DEFAULT 'policy' CHECK(entry_type IN ('policy','topic','faq','entity'));
CREATE UNIQUE INDEX knowledge_page_id_space ON knowledge_pages(id,space_id);

ALTER TABLE knowledge_sources ADD COLUMN media_type text NOT NULL DEFAULT 'text/plain';
ALTER TABLE knowledge_sources ADD COLUMN extractor_version text;
CREATE UNIQUE INDEX knowledge_source_id_space ON knowledge_sources(id,space_id);

CREATE TABLE knowledge_fragments(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 source_id text NOT NULL,
 source_revision integer NOT NULL DEFAULT 1,
 locator jsonb NOT NULL,
 locator_key text NOT NULL,
 excerpt text NOT NULL CHECK(char_length(excerpt)<=20000),
 text_hash text NOT NULL CHECK(text_hash~'^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','merged','superseded')),
 entry_id text,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,space_id),
 FOREIGN KEY(source_id,space_id) REFERENCES knowledge_sources(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(entry_id) REFERENCES knowledge_pages(id) ON DELETE SET NULL,
 UNIQUE(source_id,locator_key,text_hash)
);
CREATE INDEX knowledge_fragments_source ON knowledge_fragments(source_id,locator_key);
CREATE INDEX knowledge_fragments_entry ON knowledge_fragments(entry_id,status);
CREATE INDEX knowledge_fragments_space ON knowledge_fragments(space_id,id);

CREATE TABLE knowledge_entry_fragments(
 entry_id text NOT NULL,
 fragment_id text NOT NULL,
 space_id text NOT NULL,
 role text NOT NULL DEFAULT 'evidence' CHECK(role IN ('evidence','conflict','suggested')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(entry_id,fragment_id),
 FOREIGN KEY(entry_id,space_id) REFERENCES knowledge_pages(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(fragment_id,space_id) REFERENCES knowledge_fragments(id,space_id) ON DELETE CASCADE
);

CREATE TABLE knowledge_concepts(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 current_revision_id text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,space_id)
);

CREATE TABLE knowledge_concept_revisions(
 id text PRIMARY KEY,
 concept_id text NOT NULL,
 space_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 label text NOT NULL CHECK(char_length(label) BETWEEN 1 AND 128),
 parent_id text,
 content_hash text NOT NULL CHECK(content_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(concept_id,revision),
 UNIQUE(id,space_id),
 UNIQUE(id,concept_id),
 FOREIGN KEY(concept_id,space_id) REFERENCES knowledge_concepts(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(parent_id,space_id) REFERENCES knowledge_concepts(id,space_id),
 CHECK(parent_id IS NULL OR parent_id<>concept_id)
);
ALTER TABLE knowledge_concepts ADD CONSTRAINT knowledge_concepts_current_revision
 FOREIGN KEY(current_revision_id,id) REFERENCES knowledge_concept_revisions(id,concept_id);
CREATE INDEX knowledge_concepts_space ON knowledge_concepts(space_id,id);
CREATE INDEX knowledge_concept_revisions_parent ON knowledge_concept_revisions(parent_id,space_id);

CREATE TABLE knowledge_entry_concept_assignments(
 id text PRIMARY KEY,
 space_id text NOT NULL,
 entry_id text NOT NULL,
 concept_id text NOT NULL,
 concept_revision_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 status text NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested','confirmed','rejected')),
 content_hash text NOT NULL CHECK(content_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(entry_id,concept_id,revision),
 UNIQUE(id,space_id),
 FOREIGN KEY(entry_id,space_id) REFERENCES knowledge_pages(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(concept_revision_id,space_id) REFERENCES knowledge_concept_revisions(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(concept_id,space_id) REFERENCES knowledge_concepts(id,space_id) ON DELETE CASCADE
);
CREATE INDEX knowledge_entry_concepts_entry ON knowledge_entry_concept_assignments(entry_id,concept_id);

CREATE TABLE knowledge_relations(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 from_entry_id text NOT NULL,
 to_entry_id text NOT NULL,
 type text NOT NULL CHECK(type IN ('relatedTo','conflictsWith')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 current_revision_id text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(from_entry_id<>to_entry_id),
 UNIQUE(id,space_id),
 FOREIGN KEY(from_entry_id) REFERENCES knowledge_pages(id) ON DELETE CASCADE,
 FOREIGN KEY(to_entry_id) REFERENCES knowledge_pages(id) ON DELETE CASCADE
);

CREATE TABLE knowledge_relation_revisions(
 id text PRIMARY KEY,
 relation_id text NOT NULL,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 revision integer NOT NULL CHECK(revision>0),
 from_entry_id text NOT NULL,
 to_entry_id text NOT NULL,
 from_entry_revision_id text NOT NULL,
 to_entry_revision_id text NOT NULL,
 type text NOT NULL CHECK(type IN ('relatedTo','conflictsWith')),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 1 AND 1000),
 weight integer NOT NULL CHECK(weight BETWEEN 0 AND 100),
 content_hash text NOT NULL CHECK(content_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(relation_id,revision),
 UNIQUE(id,space_id),
 UNIQUE(id,relation_id),
 FOREIGN KEY(relation_id,space_id) REFERENCES knowledge_relations(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(from_entry_revision_id,from_entry_id) REFERENCES knowledge_revisions(id,page_id),
 FOREIGN KEY(to_entry_revision_id,to_entry_id) REFERENCES knowledge_revisions(id,page_id),
 CHECK(from_entry_revision_id<>to_entry_revision_id)
);
ALTER TABLE knowledge_relations ADD CONSTRAINT knowledge_relations_current_revision
 FOREIGN KEY(current_revision_id,id) REFERENCES knowledge_relation_revisions(id,relation_id);
CREATE INDEX knowledge_relations_space ON knowledge_relations(space_id,type);
CREATE INDEX knowledge_relation_revisions_relation ON knowledge_relation_revisions(relation_id,revision);

CREATE TABLE knowledge_relation_evidence(
 relation_revision_id text NOT NULL,
 fragment_id text NOT NULL,
 space_id text NOT NULL,
 PRIMARY KEY(relation_revision_id,fragment_id),
 FOREIGN KEY(relation_revision_id,space_id) REFERENCES knowledge_relation_revisions(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(fragment_id,space_id) REFERENCES knowledge_fragments(id,space_id) ON DELETE CASCADE
);

CREATE TABLE knowledge_entry_supersessions(
 id text PRIMARY KEY,
 space_id text NOT NULL,
 entry_id text NOT NULL,
 from_revision_id text NOT NULL,
 to_revision_id text NOT NULL,
 publication_id text REFERENCES knowledge_publications(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(from_revision_id<>to_revision_id),
 UNIQUE(entry_id,from_revision_id,to_revision_id),
 FOREIGN KEY(entry_id,space_id) REFERENCES knowledge_pages(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(from_revision_id,entry_id) REFERENCES knowledge_revisions(id,page_id),
 FOREIGN KEY(to_revision_id,entry_id) REFERENCES knowledge_revisions(id,page_id)
);

CREATE FUNCTION knowledge_enforce_supersession_order() RETURNS trigger AS $$
DECLARE from_number integer;
DECLARE to_number integer;
BEGIN
 SELECT page_revision INTO from_number FROM knowledge_revisions WHERE id=NEW.from_revision_id;
 SELECT page_revision INTO to_number FROM knowledge_revisions WHERE id=NEW.to_revision_id;
 IF from_number IS NULL OR to_number IS NULL OR from_number>=to_number THEN
  RAISE EXCEPTION 'SUPERSESSION_ORDER_INVALID' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER knowledge_supersession_order BEFORE INSERT OR UPDATE ON knowledge_entry_supersessions
 FOR EACH ROW EXECUTE FUNCTION knowledge_enforce_supersession_order();

CREATE TABLE knowledge_import_batches(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','parsing','completed','partial','failed','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by text REFERENCES principals(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,space_id)
);
CREATE INDEX knowledge_import_batches_space ON knowledge_import_batches(space_id,id);

CREATE TABLE knowledge_import_files(
 id text PRIMARY KEY,
 batch_id text NOT NULL,
 space_id text NOT NULL,
 object_ref text NOT NULL REFERENCES knowledge_objects(hash),
 filename text NOT NULL CHECK(char_length(filename) BETWEEN 1 AND 256),
 status text NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded','validated','parsing','parsed','failed','quarantined','cancelled')),
 job_id text,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,space_id),
 FOREIGN KEY(batch_id,space_id) REFERENCES knowledge_import_batches(id,space_id) ON DELETE CASCADE
);
CREATE INDEX knowledge_import_files_batch ON knowledge_import_files(batch_id,status);

CREATE TABLE knowledge_publication_snapshots(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 manifest jsonb NOT NULL,
 graph_hash text NOT NULL CHECK(graph_hash~'^[a-f0-9]{64}$'),
 policy_revision integer NOT NULL CHECK(policy_revision>0),
 approval_id text REFERENCES product_approvals(id),
 effective_at timestamptz NOT NULL,
 validity_epoch bigint NOT NULL DEFAULT 1 CHECK(validity_epoch>0),
 current boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,space_id)
);
CREATE UNIQUE INDEX knowledge_publication_current ON knowledge_publication_snapshots(space_id) WHERE current;
CREATE INDEX knowledge_publication_snapshots_space ON knowledge_publication_snapshots(space_id,effective_at);

ALTER TABLE knowledge_publications ADD COLUMN snapshot_id text REFERENCES knowledge_publication_snapshots(id);

CREATE TABLE knowledge_capabilities(
 capability_id text NOT NULL,
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','draft','active','degraded','revoked')),
 contract_ref text NOT NULL CHECK(char_length(contract_ref) BETWEEN 1 AND 512),
 owner text,
 description text,
 PRIMARY KEY(capability_id,version)
);

CREATE TABLE knowledge_publication_capabilities(
 snapshot_id text NOT NULL,
 capability_id text NOT NULL,
 capability_version integer NOT NULL,
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','draft','active','degraded','revoked')),
 consumer_ref text,
 quota integer CHECK(quota IS NULL OR quota>=0),
 last_seen_at timestamptz,
 PRIMARY KEY(snapshot_id,capability_id,capability_version),
 FOREIGN KEY(snapshot_id) REFERENCES knowledge_publication_snapshots(id) ON DELETE CASCADE,
 FOREIGN KEY(capability_id,capability_version) REFERENCES knowledge_capabilities(capability_id,version)
);

CREATE FUNCTION knowledge_space_defaults() RETURNS trigger AS $$
BEGIN
 IF NEW.code IS NULL THEN NEW.code='SPACE-'||replace(NEW.id,'-',''); END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER knowledge_space_defaults BEFORE INSERT ON knowledge_spaces
 FOR EACH ROW EXECUTE FUNCTION knowledge_space_defaults();
ALTER TABLE knowledge_spaces ALTER COLUMN code SET NOT NULL;

CREATE FUNCTION knowledge_space_policy_default() RETURNS trigger AS $$
BEGIN
 INSERT INTO knowledge_space_policy_revisions(space_id,revision,allow_self_publish)
 VALUES(NEW.id,NEW.publication_policy_revision,NEW.allow_self_publish)
 ON CONFLICT(space_id,revision) DO NOTHING;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER knowledge_space_policy_default AFTER INSERT ON knowledge_spaces
 FOR EACH ROW EXECUTE FUNCTION knowledge_space_policy_default();

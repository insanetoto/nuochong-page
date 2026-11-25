-- KBV2-06 #109: versioned entry review metadata, revision-level evidence and fragment lineage.
ALTER TABLE knowledge_pages ADD COLUMN managed_v2 boolean NOT NULL DEFAULT false;

CREATE TABLE knowledge_entry_review_meta(
 revision_id text PRIMARY KEY REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','reviewed')),
 target_hash text CHECK(target_hash IS NULL OR target_hash~'^[a-f0-9]{64}$'),
 target_input jsonb,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by text REFERENCES principals(id),
 reviewer_credential_id text REFERENCES credentials(id),
 reviewer_epoch integer,
 review_reason text,
 review_id text
);
CREATE INDEX knowledge_entry_review_status ON knowledge_entry_review_meta(status);

CREATE TABLE knowledge_revision_fragments(
 revision_id text NOT NULL REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
 fragment_id text NOT NULL,
 space_id text NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal>=1),
 role text NOT NULL DEFAULT 'evidence' CHECK(role IN ('evidence','conflict','suggested')),
 source_revision_id text NOT NULL,
 locator jsonb NOT NULL,
 text_hash text NOT NULL,
 lineage_hash text NOT NULL,
 excerpt text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(revision_id,fragment_id),
 UNIQUE(revision_id,ordinal),
 FOREIGN KEY(fragment_id,space_id) REFERENCES knowledge_fragments(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(source_revision_id) REFERENCES knowledge_sources(id)
);
CREATE INDEX knowledge_revision_fragments_fragment ON knowledge_revision_fragments(fragment_id);

CREATE TABLE knowledge_fragment_lineage(
 id text PRIMARY KEY,
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 parent_fragment_id text NOT NULL,
 child_fragment_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('merge','split')),
 ordinal integer NOT NULL CHECK(ordinal>=1),
 source_revision_id text NOT NULL REFERENCES knowledge_sources(id),
 anchor_start integer NOT NULL CHECK(anchor_start>=0),
 anchor_end integer NOT NULL CHECK(anchor_end>anchor_start),
 created_by text NOT NULL REFERENCES principals(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(parent_fragment_id,child_fragment_id,ordinal),
 FOREIGN KEY(parent_fragment_id,space_id) REFERENCES knowledge_fragments(id,space_id) ON DELETE CASCADE,
 FOREIGN KEY(child_fragment_id,space_id) REFERENCES knowledge_fragments(id,space_id) ON DELETE CASCADE
);
CREATE INDEX knowledge_fragment_lineage_parent ON knowledge_fragment_lineage(parent_fragment_id);
CREATE INDEX knowledge_fragment_lineage_child ON knowledge_fragment_lineage(child_fragment_id);

CREATE TABLE knowledge_revision_concepts(
 revision_id text NOT NULL REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
 concept_revision_id text NOT NULL REFERENCES knowledge_concept_revisions(id) ON DELETE CASCADE,
 space_id text NOT NULL,
 PRIMARY KEY(revision_id,concept_revision_id)
);
CREATE TABLE knowledge_revision_relations(
 revision_id text NOT NULL REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
 relation_revision_id text NOT NULL REFERENCES knowledge_relation_revisions(id) ON DELETE CASCADE,
 space_id text NOT NULL,
 PRIMARY KEY(revision_id,relation_revision_id)
);

CREATE TABLE knowledge_entry_reviews(
 id text PRIMARY KEY,
 revision_id text NOT NULL REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
 reviewer_id text NOT NULL REFERENCES principals(id),
 decision text NOT NULL CHECK(decision IN ('approve','reject')),
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 1000),
 target_hash text NOT NULL CHECK(target_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE knowledge_acl_revision(
 id integer PRIMARY KEY CHECK(id=1),
 revision bigint NOT NULL CHECK(revision>0)
);
INSERT INTO knowledge_acl_revision(id,revision) VALUES(1,1);

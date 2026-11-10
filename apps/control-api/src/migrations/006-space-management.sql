-- KBV2-03: independent governance proposal/approval references for space policy.
-- Platform governor registration is controlled initialization, not a business role.
CREATE TABLE product_platform_governors(
 principal_id text PRIMARY KEY REFERENCES principals(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE access_governance_proposals(
 id text PRIMARY KEY,
 command_id text NOT NULL CHECK(command_id='knowledge.spaces.publication-policy.set.v1'),
 target jsonb NOT NULL,
 target_hash text NOT NULL CHECK(target_hash~'^[a-f0-9]{64}$'),
 space_id text NOT NULL REFERENCES knowledge_spaces(id),
 requested_by text NOT NULL REFERENCES principals(id),
 credential_id text NOT NULL REFERENCES credentials(id),
 expires_at timestamptz NOT NULL,
 used boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX access_governance_proposals_space ON access_governance_proposals(space_id,created_at);

CREATE TABLE access_governance_approvals(
 id text PRIMARY KEY,
 proposal_id text NOT NULL REFERENCES access_governance_proposals(id) ON DELETE CASCADE,
 approver_id text NOT NULL REFERENCES principals(id),
 credential_id text NOT NULL REFERENCES credentials(id),
 target_hash text NOT NULL CHECK(target_hash~'^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 used boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(proposal_id,approver_id)
);
CREATE INDEX access_governance_approvals_proposal ON access_governance_approvals(proposal_id);

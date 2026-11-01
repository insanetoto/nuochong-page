CREATE TABLE product_settings(id integer PRIMARY KEY CHECK(id=1), epoch bigint NOT NULL DEFAULT 1, initialized boolean NOT NULL DEFAULT false);
INSERT INTO product_settings(id) VALUES(1);
CREATE TABLE product_plugins(id text PRIMARY KEY,version text NOT NULL,state text NOT NULL CHECK(state IN ('registered','enabled','draining','disabled')),revision integer NOT NULL DEFAULT 1);
INSERT INTO product_plugins(id,version,state) VALUES ('identity-company','1.0.0','enabled'),('organization','1.0.0','enabled'),('access-management','1.0.0','enabled'),('knowledge','1.0.0','enabled'),('enterprise-tools','1.0.0','registered'),('learning','1.0.0','registered');
CREATE TABLE product_departments(id text PRIMARY KEY,name text NOT NULL,parent_id text REFERENCES product_departments(id),active boolean NOT NULL DEFAULT true,revision integer NOT NULL DEFAULT 1,CHECK(parent_id IS NULL OR parent_id<>id));
CREATE TABLE product_members(principal_id text PRIMARY KEY REFERENCES principals(id),revision integer NOT NULL DEFAULT 1);
CREATE TABLE product_memberships(principal_id text NOT NULL REFERENCES product_members(principal_id),department_id text NOT NULL REFERENCES product_departments(id),PRIMARY KEY(principal_id,department_id));
CREATE TABLE product_accounts(username text PRIMARY KEY,principal_id text UNIQUE NOT NULL REFERENCES product_members(principal_id),salt text NOT NULL,password_hash text NOT NULL);
CREATE TABLE product_login_limit(id integer PRIMARY KEY CHECK(id=1),failures integer NOT NULL DEFAULT 0,window_start timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO product_login_limit(id) VALUES(1);
CREATE TABLE product_roles(id text PRIMARY KEY,product_id text NOT NULL,permissions text[] NOT NULL);
INSERT INTO product_roles(id,product_id,permissions) VALUES
 ('org-admin','organization',ARRAY['organization:manage','organization:read']),
 ('access-admin','access-management',ARRAY['access:manage','organization:read']),
 ('knowledge-reader','knowledge',ARRAY['knowledge:read','knowledge:ask']),
 ('knowledge-editor','knowledge',ARRAY['knowledge:read','knowledge:ask','knowledge:edit']),
 ('knowledge-reviewer','knowledge',ARRAY['knowledge:read','knowledge:ask','knowledge:review']),
 ('knowledge-publisher','knowledge',ARRAY['knowledge:read','knowledge:ask','knowledge:publish']),
 ('tool-user','enterprise-tools',ARRAY['enterprise-tools:use']),
 ('learner','learning',ARRAY['learning:study']);
CREATE TABLE product_bindings(id text PRIMARY KEY,principal_id text NOT NULL REFERENCES product_members(principal_id),role_id text NOT NULL REFERENCES product_roles(id),scope_id text NOT NULL,revision integer NOT NULL DEFAULT 1,UNIQUE(principal_id,role_id,scope_id));
CREATE TABLE product_approvals(id text PRIMARY KEY,command_id text NOT NULL,target_hash text NOT NULL,scope_id text NOT NULL,approver_id text NOT NULL REFERENCES principals(id),credential_id text NOT NULL REFERENCES credentials(id),expires_at timestamptz NOT NULL,used boolean NOT NULL DEFAULT false,reason text NOT NULL);
CREATE TABLE product_writes(actor_id text NOT NULL REFERENCES principals(id),command_id text NOT NULL,key text NOT NULL,input_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,command_id,key));
CREATE TABLE product_outbox(id bigserial PRIMARY KEY,event_id text UNIQUE NOT NULL,type text NOT NULL,resource_id text NOT NULL,revision bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());

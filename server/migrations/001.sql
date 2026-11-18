CREATE TABLE IF NOT EXISTS temples (id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY,email text UNIQUE NOT NULL,password_hash text NOT NULL,name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS temple_memberships (temple_id uuid REFERENCES temples(id),user_id uuid REFERENCES users(id),role text NOT NULL CHECK(role IN ('super_admin','temple_admin','approver','manager','staff','viewer')),active boolean NOT NULL DEFAULT true,PRIMARY KEY(temple_id,user_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY,user_id uuid REFERENCES users(id),temple_id uuid REFERENCES temples(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
-- Versioned envelope, shared by all replicated entities. Domain data is validated at the API boundary.
CREATE TABLE IF NOT EXISTS records (id uuid PRIMARY KEY,temple_id uuid NOT NULL REFERENCES temples(id),kind text NOT NULL,data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),created_by uuid NOT NULL REFERENCES users(id),updated_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,UNIQUE(temple_id,id));
CREATE INDEX IF NOT EXISTS records_tenant_kind ON records(temple_id,kind);
CREATE UNIQUE INDEX IF NOT EXISTS asset_codes ON records(temple_id,(data->>'code')) WHERE kind='asset';
CREATE TABLE IF NOT EXISTS sync_operations(id uuid PRIMARY KEY,temple_id uuid NOT NULL REFERENCES temples(id),user_id uuid NOT NULL REFERENCES users(id),request jsonb NOT NULL,response jsonb NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS asset_audit_logs(id uuid PRIMARY KEY,temple_id uuid NOT NULL REFERENCES temples(id),entity_id uuid NOT NULL,user_id uuid NOT NULL REFERENCES users(id),action text NOT NULL,before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_entity ON asset_audit_logs(temple_id,entity_id,created_at);
CREATE TABLE IF NOT EXISTS asset_images(id uuid PRIMARY KEY,temple_id uuid NOT NULL,asset_id uuid NOT NULL,caption text NOT NULL DEFAULT '',mime text NOT NULL,bytes integer NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(temple_id,asset_id) REFERENCES records(temple_id,id));
CREATE TABLE IF NOT EXISTS asset_transfers(id uuid PRIMARY KEY,temple_id uuid NOT NULL REFERENCES temples(id),asset_id uuid NOT NULL,from_location uuid,to_location uuid NOT NULL,reason text NOT NULL,operator_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(temple_id,asset_id) REFERENCES records(temple_id,id));
-- RLS is defense in depth when using a non-owner production database role.
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_records ON records;
CREATE POLICY tenant_records ON records USING(temple_id::text=current_setting('app.temple_id',true)) WITH CHECK(temple_id::text=current_setting('app.temple_id',true));
DROP POLICY IF EXISTS tenant_images ON asset_images;
CREATE POLICY tenant_images ON asset_images USING(temple_id::text=current_setting('app.temple_id',true)) WITH CHECK(temple_id::text=current_setting('app.temple_id',true));
DROP POLICY IF EXISTS tenant_audit ON asset_audit_logs;
CREATE POLICY tenant_audit ON asset_audit_logs USING(temple_id::text=current_setting('app.temple_id',true)) WITH CHECK(temple_id::text=current_setting('app.temple_id',true));
DROP POLICY IF EXISTS tenant_transfers ON asset_transfers;
CREATE POLICY tenant_transfers ON asset_transfers USING(temple_id::text=current_setting('app.temple_id',true)) WITH CHECK(temple_id::text=current_setting('app.temple_id',true));

CREATE TABLE IF NOT EXISTS asset_documents(id uuid PRIMARY KEY,temple_id uuid NOT NULL,asset_id uuid NOT NULL,name text NOT NULL,bytes integer NOT NULL,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(temple_id,asset_id) REFERENCES records(temple_id,id));
ALTER TABLE asset_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_documents ON asset_documents;
CREATE POLICY tenant_documents ON asset_documents USING(temple_id::text=current_setting('app.temple_id',true)) WITH CHECK(temple_id::text=current_setting('app.temple_id',true));

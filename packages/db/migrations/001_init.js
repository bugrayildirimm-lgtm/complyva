export async function up(pgm) {
  pgm.sql(`create extension if not exists "pgcrypto";`);

  pgm.sql(`
    create table if not exists organisations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      industry text,
      country text,
      created_at timestamptz not null default now()
    );

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      full_name text,
      cognito_sub text unique,
      created_at timestamptz not null default now()
    );

    create table if not exists memberships (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      role text not null check (role in ('ADMIN','AUDITOR','VIEWER')),
      created_at timestamptz not null default now(),
      unique (org_id, user_id)
    );

    create table if not exists certifications (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      name text not null,
      framework_type text,
      issuing_body text,
      issue_date date,
      expiry_date date,
      status text not null default 'ACTIVE' check (status in ('ACTIVE','PENDING','EXPIRED','REVOKED')),
      owner_user_id uuid references users(id),
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists certifications_org on certifications(org_id);
    create index if not exists certifications_org_expiry on certifications(org_id, expiry_date);

    create table if not exists risks (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      title text not null,
      description text,
      category text,
      likelihood int not null check (likelihood between 1 and 5),
      impact int not null check (impact between 1 and 5),
      inherent_score int generated always as (likelihood * impact) stored,
      residual_likelihood int check (residual_likelihood between 1 and 5),
      residual_impact int check (residual_impact between 1 and 5),
      residual_score int generated always as (coalesce(residual_likelihood,0) * coalesce(residual_impact,0)) stored,
      status text not null default 'OPEN' check (status in ('OPEN','IN_TREATMENT','ACCEPTED','CLOSED')),
      owner_user_id uuid references users(id),
      treatment_plan text,
      due_date date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists risks_org on risks(org_id);
    create index if not exists risks_org_status on risks(org_id, status);

    create table if not exists audits (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      type text not null check (type in ('INTERNAL','EXTERNAL','CERTIFICATION')),
      title text not null,
      scope text,
      auditor text,
      start_date date,
      end_date date,
      status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists audits_org on audits(org_id);

    create table if not exists audit_findings (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      audit_id uuid not null references audits(id) on delete cascade,
      title text not null,
      description text,
      severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
      recommendation text,
      owner_user_id uuid references users(id),
      due_date date,
      status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','RESOLVED','ACCEPTED')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists findings_org on audit_findings(org_id);
    create index if not exists findings_audit on audit_findings(audit_id);

    create table if not exists evidence_files (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      entity_type text not null check (entity_type in ('CERTIFICATION','RISK','AUDIT','FINDING')),
      entity_id uuid not null,
      file_name text not null,
      mime_type text,
      file_size bigint,
      s3_key text not null,
      uploaded_by uuid references users(id),
      uploaded_at timestamptz not null default now()
    );
    create index if not exists evidence_lookup on evidence_files(org_id, entity_type, entity_id);

    create table if not exists reminder_jobs (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      kind text not null check (kind in ('CERT_EXPIRY')),
      entity_id uuid not null,
      remind_on date not null,
      sent_at timestamptz,
      created_at timestamptz not null default now(),
      unique (kind, entity_id, remind_on)
    );

    create table if not exists activity_log (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references organisations(id) on delete cascade,
      actor_user_id uuid references users(id),
      action text not null,
      entity_type text,
      entity_id uuid,
      meta jsonb,
      created_at timestamptz not null default now()
    );
  `);
}

export async function down(pgm) {
  pgm.sql(`
    drop table if exists activity_log;
    drop table if exists reminder_jobs;
    drop table if exists evidence_files;
    drop table if exists audit_findings;
    drop table if exists audits;
    drop table if exists risks;
    drop table if exists certifications;
    drop table if exists memberships;
    drop table if exists users;
    drop table if exists organisations;
  `);
}

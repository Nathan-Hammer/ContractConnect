# Supabase and database guide

## Supported deployment model

Use a separate Supabase project for every production customer. Do not use the current schema for unrelated customers in one project.

## Migration order

Apply SQL files in this order through the Supabase SQL Editor:

1. `supabase-schema.sql`
2. `supabase-auth-migration.sql`
3. `supabase-followups-migration.sql`
4. `supabase-contract-lifecycle-migration.sql`
5. `supabase-contract-documents-migration.sql`
6. `supabase-profile-customization-migration.sql`
7. `supabase-governance-migration.sql`
8. `supabase-security-hardening-migration.sql`
9. `supabase-production-business-data-migration.sql`

The final migration activates existing profiles, makes new profiles inactive and Read-only, corrects management profile visibility, replaces CRM policies with active-member policies, and creates runtime security events.

The production business-data migration adds server-side financial years, partner masters, period-specific partner targets, itemised partner sales, service-level agreements, and per-user notification read state. It also enables RLS, role-aware writes, database constraints, and audit triggers for shared business records.

Record each applied migration, timestamp, operator, environment, and result in the deployment change record. Take a backup before applying a migration to a customer environment.

## Data dictionary

### `profiles`

| Column | Purpose |
|---|---|
| `id` | Supabase Authentication user ID |
| `full_name` | Display name |
| `role` | Administrator, Manager, Contributor, or Read-only |
| `is_active` | Workspace approval state |
| `avatar_url` | Public avatar URL |
| `created_at`, `updated_at` | Lifecycle timestamps |

### `companies`

Stores company identity, industry, location, relationship status, contact details, free-text owner, notes, display initials, and colour. `owner_id` was added for governed ownership but is not yet used by application mapping or RLS.

### `contacts`

Links people to companies using `company_id`. Includes job role, email, phone, and primary-contact indicator. Company deletion cascades to contacts.

### `contracts`

Links a contract to a company. Includes title, NAD value, start/end dates, stored status, renewal notice days, automatic-renewal indicator, termination notice date, and an ownership ID. Runtime lifecycle status is recalculated in the UI from dates and notice period.

### `interactions`

Stores dated calls, meetings, emails, or notes. Contact is optional and becomes null if that contact is deleted.

### `followups`

Stores company/contact-linked actions with due date, priority, completion state, and completion timestamp.

### `contract_documents`

Stores Storage path, original name, category, manual version number, size, MIME type, uploader, access level, and timestamp. The file itself lives in the private `contract-documents` bucket.

### `audit_logs`

Database triggers capture table, record, operation, actor, and old/new JSON for CRM changes. Managers and administrators can read the audit log. Retention and sensitive-field minimisation remain operational tasks.

### `security_events`

Stores sanitised runtime events: event type, severity, limited context, page path, actor, and timestamp. Users may insert events attributed to themselves; managers and administrators may read them.

### `financial_years`, `partners`, `partner_targets`, and `partner_sales`

Financial years define reporting periods. Partner identity is stored independently from each period's target so a new target does not overwrite historical commitments. Sales are itemised transactions linked to a period-specific target and either an existing company or a manually entered client name.

### `service_level_agreements`

Stores contract-linked service commitments, availability and time targets, review frequency, effective dates, and lifecycle status. Contract deletion cascades to its SLAs.

### `notification_reads`

Stores each user's read state for follow-up notifications. Rows are private to that user through RLS and are removed when the related follow-up or user is deleted.

## Role matrix

| Capability | Administrator | Manager | Contributor | Read-only | Inactive |
|---|---:|---:|---:|---:|---:|
| Read CRM records | Yes | Yes | Yes | Yes | No |
| Change CRM records | Yes | Yes | Yes | No | No |
| Read all-team documents | Yes | Yes | Yes | Yes | No |
| Read manager-only documents | Yes | Yes | No | No | No |
| Upload/delete documents through current RLS | Yes | Yes | Yes | No | No |
| View audit/security events | Yes | Yes | No | No | No |
| Approve users and change roles | Yes | No | No | No | No |
| Read own profile | Yes | Yes | Yes | Yes | Yes |

The UI hides restricted-document creation from Contributors, but current database write policies allow Contributors to manipulate document metadata and Storage objects. Treat this as a known limitation and address it before stricter document-governance requirements apply.

## Storage

| Bucket | Visibility | Limit | Types |
|---|---|---:|---|
| `contract-documents` | Private | 20 MB/file | PDF, Word, JPEG, PNG |
| `avatars` | Public | 5 MB/file | JPEG, PNG, WebP |

MIME allowlists are not malware scanning. Uploaded contract documents should be treated as untrusted.

## RLS verification

After migrations, use separate test accounts for every role and verify direct Supabase requests, not only UI controls:

- Inactive: own profile only; no CRM or document access
- Read-only: reads allowed; all writes rejected
- Contributor: CRM writes allowed; restricted reads rejected
- Manager: restricted reads and logs allowed; profile security changes rejected
- Administrator: member approval and role updates allowed

## Migration practices

- Add new forward-only migration files; do not alter a migration already applied to shared environments.
- Use constraints and indexes with every schema change where appropriate.
- Make migrations rerunnable when practical with `if exists`/`if not exists`.
- Review `security definer` functions carefully and set an explicit `search_path`.
- Add or update RLS for every new customer-owned table.
- Test both positive and negative permission cases.
- Document data backfills and recovery procedures.

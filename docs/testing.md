# Testing and quality guide

## Current automated gates

| Gate | Command | Coverage |
|---|---|---|
| Repository security verification | `npm run security:verify` | Threat model, pinned dependencies, runtime guards, secure defaults, migration controls, headers, WAF and CI presence |
| Production build | `npm run build` | Vite compilation and production bundle creation |
| Dependency audit | `npm audit --omit=dev --audit-level=high` | Known production dependency vulnerabilities |
| Live deployment check | `npm run security:verify:deployment -- --url=https://...` | HTTPS response, application marker, and required security headers |

The MVP does not yet include a unit, component, end-to-end, or SQL-policy test framework. Manual acceptance and direct role testing therefore remain mandatory. Adding automated tests is a priority before frequent production releases.

## Recommended test layers

1. **Unit tests:** lifecycle calculations, mapping functions, CSV escaping, validation, and report calculations.
2. **Component tests:** forms, permission-aware controls, loading/error states, and account approval.
3. **Integration tests:** Supabase CRUD, Storage, signed URLs, audit triggers, and security events.
4. **RLS negative tests:** direct API requests for every role and inactive/anonymous identities.
5. **End-to-end tests:** authentication, core workflows, exports, governance, and mobile navigation.
6. **Deployment tests:** headers, CSP reporting, WAF rules, availability, and recovery.

## Manual release checklist

### Authentication and profiles

- [ ] Valid user can sign in and sign out.
- [ ] Invalid credentials fail without disclosing sensitive details.
- [ ] Password recovery uses an approved redirect.
- [ ] New identity remains inactive until administrator approval.
- [ ] Deactivated user cannot access CRM records after session refresh/revocation.
- [ ] Profile name, password, avatar, and theme updates behave correctly.

### Role matrix

- [ ] Anonymous user has no database or Storage access.
- [ ] Inactive user can read only their own profile and submit own security events.
- [ ] Read-only user cannot write by UI or direct API.
- [ ] Contributor can perform expected CRM changes.
- [ ] Contributor cannot read manager-only document metadata or files.
- [ ] Manager can view restricted files and audit/security events.
- [ ] Manager cannot approve users or change roles.
- [ ] Administrator can approve/deactivate users and assign roles.

### CRM workflows

- [ ] Company create, update, search, filter, profile, and deletion work.
- [ ] Contacts remain linked to the correct company.
- [ ] Contract date constraints and renewal status behave correctly.
- [ ] Interactions appear in chronological order.
- [ ] Follow-up overdue, complete, reopen, and priority filtering work.
- [ ] Reports recalculate after changes.
- [ ] CSV values containing quotes and commas export correctly.

### Documents

- [ ] Allowed file types under 20 MB upload successfully.
- [ ] Disallowed type and oversized file are rejected.
- [ ] Metadata and Storage access agree for both access levels.
- [ ] Signed link expires.
- [ ] Deletion removes metadata and object or produces a recoverable error.
- [ ] Malicious test files follow the approved quarantine/scanning process when added.

### Production safety

- [ ] Production uses `VITE_DEMO_MODE=false`.
- [ ] Production uses `VITE_ALLOW_PUBLIC_SIGNUP=false`.
- [ ] Public sign-up is disabled in Supabase.
- [ ] No demo reset control is visible.
- [ ] CRM data is not stored in localStorage.
- [ ] Security headers pass the deployment verifier.
- [ ] WAF rules are active and reviewed.
- [ ] High/critical security events trigger an alert.
- [ ] Restore procedure has been tested.

## Test data

Use only fictional data in development and test environments. Keep dedicated test users for every role. Never copy production credentials, contract documents, contact details, tokens, or exports into source control, test fixtures, screenshots, or issue trackers.

## Defect severity

| Severity | Example | Release action |
|---|---|---|
| Critical | Cross-customer exposure, authentication bypass, destructive production seeding | Stop deployment/operation immediately |
| High | Role bypass, restricted-document exposure, unrecoverable data loss | Block release; urgent remediation |
| Medium | Workflow failure with safe workaround, incomplete audit view | Fix before next planned release or formally accept |
| Low | Cosmetic or minor usability issue | Schedule normally |

## Evidence

Attach command output, environment identifier, test account role, timestamp, and result to the release record. Do not attach credentials or sensitive customer records.


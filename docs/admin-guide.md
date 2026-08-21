# Administrator guide

## Administrator responsibilities

Administrators control workspace activation, roles, production configuration, data handling, and access reviews. They are also responsible for ensuring the deployment remains dedicated to one customer.

## User lifecycle

### Production onboarding

1. Disable public sign-up in Supabase Authentication settings.
2. Invite or create the approved identity using the authorised administrative process.
3. Confirm the profile appears in **Governance** as **Awaiting approval**.
4. Select the least-privilege role.
5. Approve access.
6. Ask the user to sign in and validate the expected access.
7. Record the approval and business owner outside the application if required by policy.

The application flag `VITE_ALLOW_PUBLIC_SIGNUP=false` hides public sign-up, but the Supabase setting is the authoritative control.

### Role selection

- **Administrator:** access approval, role administration, all CRM/document operations, audit and security events
- **Manager:** CRM/document operations, restricted documents, audit and security-event visibility
- **Contributor:** CRM and document changes, but no restricted-document reading or governance logs
- **Read-only:** record and all-team document viewing without writes

Avoid assigning more than two Administrators unless operational continuity requires it. Do not use shared accounts.

### Deactivation

Deactivate access promptly when a person leaves or no longer requires the workspace. Then:

1. Reassign owned responsibilities.
2. Review recent audit events.
3. Revoke active sessions through Supabase if the risk warrants it.
4. Remove the identity only after retention and audit requirements are satisfied.

## Access reviews

At least monthly for production:

- Confirm every active user still requires access.
- Review Administrator and Manager assignments.
- Investigate inactive/pending accounts.
- Review role changes and unusual CRM deletions.
- Confirm restricted-document access remains appropriate.
- Record the reviewer, date, findings, and remediation.

## Demonstration controls

Demo mode must never be enabled in a production build. It permits fictional seeding and exposes a reset operation that deletes CRM data before reseeding.

Use a separate demonstration Supabase project and environment:

```env
VITE_DEMO_MODE=true
VITE_ALLOW_PUBLIC_SIGNUP=true
```

Production:

```env
VITE_DEMO_MODE=false
VITE_ALLOW_PUBLIC_SIGNUP=false
```

## Data administration

- Obtain approval before uploading real information.
- Treat CSV exports as confidential files.
- Keep an inventory of customer environments and data owners.
- Define retention for CRM records, documents, audit logs, security events, backups, and exports.
- Test restoration rather than assuming a platform backup is usable.
- Do not use the application reset function for deletion or customer offboarding.

## Audit and security events

The Governance screen shows recent database audit activity. Runtime events are stored separately in `security_events`. External alerts should notify the responsible operator of high and critical events.

Do not place passwords, access tokens, recovery links, document contents, or complete customer records into event context.

## Restricted documents

Manager-only access is enforced in both metadata RLS and Storage path policies. Confirm access using direct tests with Manager, Contributor, and Read-only accounts after any policy or upload change.

There is no malware scanner. Establish an approved-file handling process and consider external scanning before production document exchange.

## Incident response

For suspected unauthorised access:

1. Preserve logs and record the initial report time.
2. Disable affected profiles and revoke sessions.
3. Protect backups and avoid destructive cleanup.
4. Determine affected records, documents, users, and time range.
5. Rotate compromised credentials and review Supabase/hosting configuration.
6. Follow organisational notification and legal requirements.
7. Record root cause, corrective actions, and threat-model updates.

See [Operations runbook](operations.md) for response and recovery detail.


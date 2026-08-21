# Operations runbook

## Service ownership

Assign named owners for:

- Product decisions
- Application releases
- Supabase administration
- Hosting, DNS, TLS, headers, and WAF
- Security monitoring and incident response
- Backup and recovery
- Customer access approval
- Customer support and escalation

The same person may hold multiple responsibilities in a small team, but ownership must be explicit.

## Daily checks

- Application availability and sign-in health
- New high/critical `security_events`
- Authentication anomalies and repeated failures
- Hosting and Supabase errors or quota warnings
- WAF blocked/challenged traffic anomalies
- Failed scheduled security-verification workflow

## Weekly checks

- Dependabot and dependency-audit results
- High-volume updates/deletes and unusual audit activity
- Pending/inactive accounts
- Storage growth and failed document operations
- Backup status
- Open security and availability incidents

## Monthly checks

- Privileged and active-user access review
- Customer environment inventory
- Security event and audit retention
- WAF false positives and rule changes
- Usage, performance, hosting, and Supabase cost trends
- Recovery documentation currency

## Quarterly and annual checks

- Quarterly test restoration of database and document data
- Quarterly incident-response exercise
- Annual threat-model review
- Annual independent penetration test, or after a major architecture change
- Review data retention, customer contracts, and security obligations

## Health checks

The deployment verifier confirms the frontend and response headers. It does not prove database or Storage workflows. Production monitoring should also exercise a low-risk authenticated health workflow using a dedicated synthetic account and non-customer record where organisational policy permits.

## Security-event triage

Prioritise by severity:

- **Critical:** immediate notification and incident assessment
- **High:** same-day investigation
- **Warning:** review trends and repeated patterns
- **Info:** operational context

Useful fields are actor, event type, page path, time, and sanitised context. Correlate with Supabase authentication, audit logs, hosting, WAF, and customer reports. Do not assume every client-reported event is trustworthy.

## Backup and recovery

Define and approve:

- Recovery Point Objective (maximum acceptable data loss)
- Recovery Time Objective (maximum acceptable outage)
- Database backup schedule and retention
- Storage object backup/recovery method
- Encryption and access control for backups
- Recovery environment and responsible operator

A database-only restore is incomplete if contract documents are not recoverable. Test both metadata and objects.

### Restore exercise

1. Select a non-production target.
2. Record the backup timestamp and expected records/files.
3. Restore database and Storage according to the platform procedure.
4. Validate authentication/profile mappings, row counts, sample relationships, audit continuity, document downloads, and RLS.
5. Record actual recovery point and duration.
6. Correct gaps and update this runbook.

## Incident response

### Detect and classify

Record reporter, time, affected environment, initial evidence, and suspected data. Assign severity without delaying containment.

### Contain

- Deactivate affected profiles and revoke sessions.
- Restrict WAF or network access where appropriate.
- Preserve audit, security, hosting, and authentication logs.
- Stop automated deployment or destructive jobs.
- Protect backups.

### Investigate

Build a timeline, identify root cause, determine affected users/records/files, and assess whether data left authorised boundaries.

### Recover

Patch the cause, validate security controls, restore data when required, rotate affected credentials, and monitor closely after service restoration.

### Learn

Complete a blameless post-incident review. Update tests, documentation, alerts, runbooks, and the threat model. Track actions to completion.

## Customer offboarding

1. Confirm authority and retention obligations.
2. Provide an approved export where contracted.
3. Disable access and revoke sessions.
4. Preserve required audit and legal records.
5. Delete customer data, Storage objects, backups, and deployment secrets according to policy.
6. Verify deletion independently.
7. Record completion and approvals.

Do not use demo reset as an offboarding or deletion mechanism.


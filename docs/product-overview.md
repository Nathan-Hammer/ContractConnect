# Product overview

## Purpose

ContractConnect gives teams a single view of contracted companies, the people associated with them, contract terms, documents, recent interactions, and upcoming actions. It is designed for organisations that need more contract context than a basic contact list without adopting a large enterprise CRM or contract lifecycle platform.

## Primary users

- Contract and commercial administrators
- Account and relationship managers
- Operational contributors
- Management and compliance reviewers
- Read-only stakeholders

## Core workflows

1. Register a company and its primary contacts.
2. Record contract value, dates, status, renewal terms, and termination notice date.
3. Upload agreements, amendments, certificates, and supporting files.
4. Log calls, meetings, email summaries, and notes.
5. Create and complete follow-up actions.
6. Review dashboard metrics, renewals, reports, and relationship-health indicators.
7. Export approved datasets or download blank preparation templates.
8. Administer access and inspect audit activity.

## Functional scope

| Area | Current capability |
|---|---|
| Companies | Create, update, delete, filter, and open relationship profiles |
| Contacts | Link people to companies and identify primary contacts |
| Contracts | Track value, dates, lifecycle state, notice period, and automatic renewal |
| Documents | Private upload, categories, manual version number, signed download, deletion, manager restriction |
| Interactions | Record calls, meetings, emails, and notes |
| Follow-ups | Priority, due date, completion, overdue state, and dashboard visibility |
| Search | Cross-record search covering CRM entities and documents |
| Reports | Portfolio value, lifecycle value, renewal volumes, activity trends, completion, and stale relationships |
| Governance | Four roles, active-member approval, database audit trail, and security-event storage |
| Personalisation | Display name, password, avatar, and light/dark theme |

## Current limitations

- Shared multi-tenancy is not implemented.
- Document versions are manually labelled; there is no automatic version chain or restore function.
- Saved company filters are browser-local rather than user-synchronised.
- Real-data import is not available through the interface.
- Calendar, email, e-signature, workflow notification, and AI integrations are deferred.
- Subscription tiers and capacity limits are not enforced by the application.
- Malware scanning is not implemented for uploaded documents.
- Runtime security events require an external alerting integration.
- A conventional certified RASP product is not present because there is no instrumentable application server.

## Deployment model

The supported production model is one frontend deployment and one dedicated Supabase project per customer. This is a security boundary, not merely a preference. See [ADR-0001](adr/0001-dedicated-customer-deployments.md).


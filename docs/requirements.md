# Software requirements specification

## Purpose and scope

This document defines the currently implemented MVP requirements and the production constraints that accompany them. Requirement IDs provide stable references for issues, tests, releases, and change requests.

## Functional requirements

### Identity and access

| ID | Requirement | Status |
|---|---|---|
| FR-AUTH-001 | Users shall authenticate through Supabase email/password authentication. | Implemented |
| FR-AUTH-002 | Users shall request password recovery through an approved redirect flow. | Implemented |
| FR-AUTH-003 | New profiles shall remain inactive and Read-only until Administrator approval. | Implemented; requires hardening migration |
| FR-AUTH-004 | Administrators shall activate/deactivate members and assign roles. | Implemented |
| FR-AUTH-005 | Managers shall view governance activity but shall not administer roles or activation. | Implemented |
| FR-AUTH-006 | Read-only users shall be denied write operations by database policy. | Implemented |

### Relationship management

| ID | Requirement | Status |
|---|---|---|
| FR-CRM-001 | Users shall manage company records. | Implemented |
| FR-CRM-002 | Users shall link contact people to companies and identify primary contacts. | Implemented |
| FR-CRM-003 | Users shall record dated interactions with an optional contact. | Implemented |
| FR-CRM-004 | Users shall create, prioritise, complete, reopen, and delete follow-ups. | Implemented |
| FR-CRM-005 | Users shall search across core CRM entities and document names. | Implemented |
| FR-CRM-006 | Users shall filter companies and save browser-local company filters. | Implemented with local-only limitation |

### Contract lifecycle

| ID | Requirement | Status |
|---|---|---|
| FR-CON-001 | Users shall record contract value, dates, status, and company. | Implemented |
| FR-CON-002 | Users shall record renewal-notice period, automatic renewal, and termination-notice date. | Implemented |
| FR-CON-003 | The application shall calculate active, expiring, and expired lifecycle state from dates. | Implemented |
| FR-CON-004 | Users shall filter contracts by 30-, 60-, and 90-day renewal windows. | Implemented |

### Documents

| ID | Requirement | Status |
|---|---|---|
| FR-DOC-001 | Active authorised users shall upload approved document types up to 20 MB. | Implemented |
| FR-DOC-002 | Documents shall be linked to contracts and categorised. | Implemented |
| FR-DOC-003 | Users shall assign a manual positive version number. | Implemented |
| FR-DOC-004 | Managers and Administrators shall read manager-only documents. | Implemented |
| FR-DOC-005 | Downloads shall use short-lived signed URLs. | Implemented |
| FR-DOC-006 | The system shall scan uploaded files for malware before release. | Not implemented |

### Reporting and data movement

| ID | Requirement | Status |
|---|---|---|
| FR-REP-001 | The dashboard shall show company, value, contact, renewal, activity, and follow-up summaries. | Implemented |
| FR-REP-002 | Reports shall show value, renewal, interaction, completion, and relationship-health views. | Implemented |
| FR-REP-003 | Users shall export current CRM datasets as CSV. | Implemented |
| FR-REP-004 | Users shall download blank CSV preparation templates. | Implemented |
| FR-REP-005 | The application shall import completed templates. | Not implemented |

### Audit and runtime security

| ID | Requirement | Status |
|---|---|---|
| FR-SEC-001 | CRM changes shall produce database audit events. | Implemented |
| FR-SEC-002 | Runtime failures and CSP violations shall produce sanitised security events where connectivity permits. | Implemented |
| FR-SEC-003 | Authenticated sessions shall be revalidated periodically and on return to the page. | Implemented |
| FR-SEC-004 | Production startup shall reject missing Supabase, demo mode, or public-signup UI configuration. | Implemented |

## Non-functional requirements

| ID | Requirement | Verification |
|---|---|---|
| NFR-SEC-001 | Every production customer shall use a dedicated Supabase project. | Deployment inventory and ADR review |
| NFR-SEC-002 | RLS and Storage policies shall authorise all server-side data operations. | Direct role-matrix tests |
| NFR-SEC-003 | No service-role credential or production data shall be present in browser code or source control. | Security verification, secret scanning, review |
| NFR-SEC-004 | Production shall disable demo mode and public sign-up in both application and Supabase configuration. | Runtime assertion and deployment checklist |
| NFR-SEC-005 | Production responses shall include approved CSP, HSTS, framing, MIME, referrer, and permissions headers. | Post-deployment verifier |
| NFR-SEC-006 | The production hostname shall use an approved WAF or documented equivalent. | Infrastructure plan and WAF event evidence |
| NFR-SEC-007 | High/critical security events shall notify an assigned responder. | Alert test |
| NFR-REL-001 | Database and document backups shall meet approved RPO/RTO and be restore-tested quarterly. | Recovery exercise record |
| NFR-PERF-001 | Common screens shall remain usable with the approved customer dataset size. | Performance acceptance test; thresholds to be agreed |
| NFR-ACC-001 | Interactive controls shall have accessible names and keyboard-operable workflows. | Accessibility review |
| NFR-COMP-001 | Customer data retention, export, and deletion shall follow approved organisational policy. | Operational review |
| NFR-MNT-001 | Security verification and production build shall pass before release. | CI/release evidence |
| NFR-MNT-002 | Documentation and threat model shall change with affected behaviour or trust boundaries. | Pull-request review |

## Deferred requirements

- Calendar synchronisation
- Email integration
- Automated workflow notifications
- Electronic signature
- Advanced analytics and AI assistance
- Shared multi-tenancy
- Subscription entitlement and billing enforcement
- Enterprise SSO
- Certified RASP integration

## Acceptance and change control

Changes to a requirement should identify affected code, data model, roles, tests, documentation, deployment, monitoring, and threats. A requirement is not considered production-ready solely because its UI exists; server-side authorisation, negative tests, operational configuration, and release evidence must also be complete.


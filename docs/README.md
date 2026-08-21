# ContractConnect documentation

This directory is the maintained documentation set for ContractConnect. Documentation changes should accompany any change to user behaviour, data structures, deployment steps, security controls, or operational procedures.

## Audience map

| Audience | Start here | Supporting documents |
|---|---|---|
| Product stakeholders | [Product overview](product-overview.md) | [Requirements](requirements.md), [Roadmap](../PROJECT_ROADMAP.md), [Costing model](../ContractConnect_Costing_Model.docx) |
| End users | [User guide](user-guide.md) | [Troubleshooting](troubleshooting.md) |
| Administrators | [Administrator guide](admin-guide.md) | [Operations](operations.md), [Security operations](../SECURITY_OPERATIONS.md) |
| Developers | [Development guide](development.md) | [Architecture](architecture.md), [Database](database.md), [Testing](testing.md) |
| Deployment engineers | [Deployment guide](deployment.md) | [Operations](operations.md), [Cloudflare WAF](../infra/cloudflare/waf.tf) |
| Security reviewers | [Threat model](../THREAT_MODEL.md) | [Security operations](../SECURITY_OPERATIONS.md), [ADR-0001](adr/0001-dedicated-customer-deployments.md) |

## Document ownership

| Document | Primary owner | Review trigger |
|---|---|---|
| Product overview and user guide | Product owner | Feature or workflow change |
| Architecture and database | Technical lead | Component, schema, or integration change |
| Deployment and operations | Deployment owner | Hosting, environment, or support change |
| Testing | Technical lead | Test tooling or release-gate change |
| Threat model and security operations | Security/technical owner | Security control, authentication, RLS, integration, or annual review |

## Source-of-truth rules

- SQL migrations are the source of truth for database objects and policies.
- `package.json` is the source of truth for commands and dependency versions.
- `.env.example` is the source of truth for supported application environment variables.
- `PROJECT_ROADMAP.md` is the source of truth for implementation status.
- `THREAT_MODEL.md` is the source of truth for known security risks and treatment decisions.
- If documentation conflicts with executable configuration, correct the documentation or implementation before release; do not leave the discrepancy unresolved.

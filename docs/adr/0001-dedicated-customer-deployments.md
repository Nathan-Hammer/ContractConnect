# ADR-0001: Dedicated customer deployments

- **Status:** Accepted
- **Date:** 10 August 2026
- **Decision owners:** Product owner and technical owner

## Context

Current CRM table read policies allow active authenticated workspace members to read all records in a Supabase project. The schema does not include organisations, memberships tied to organisations, or an `organisation_id` on customer-owned records and Storage paths.

## Decision

Every production customer receives a dedicated Supabase project and corresponding frontend configuration. Unrelated customers must not share one ContractConnect database or Storage bucket.

## Consequences

### Positive

- Establishes an immediate customer isolation boundary.
- Reduces the blast radius of configuration and data errors.
- Simplifies customer-specific backup, retention, and deletion.

### Negative

- Each customer requires separate provisioning, migration, monitoring, and maintenance.
- Hosting costs do not benefit fully from shared infrastructure.
- Cross-customer administration and aggregated analytics are unavailable.

## Conditions for revisiting

Shared SaaS may be considered only after:

1. Organisations and memberships are modelled.
2. Every customer-owned row and object path carries a non-null tenant identifier.
3. Tenant-aware RLS and Storage policies replace global workspace reads.
4. Automated cross-tenant negative tests cover reads, writes, joins, exports, signed URLs, and deletion.
5. An independent security review approves the architecture.


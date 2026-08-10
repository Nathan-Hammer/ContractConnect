# ContractConnect Product Roadmap

This checklist is the source of truth for core product development. An item is checked only after it is implemented and verified.

## Foundation

- [x] Company records
- [x] Contact records linked to companies
- [x] Contract records linked to companies
- [x] Interaction history
- [x] Follow-up tasks with priorities and due dates
- [x] Supabase authentication and user profiles
- [x] Supabase persistence with fictional demo data
- [x] CSV exports and blank migration templates

## 1. Contract lifecycle and renewal management

- [x] Automatically calculate active, expiring, and expired contract states
- [x] Add configurable renewal notice periods
- [x] Add 30, 60, and 90-day renewal views
- [x] Record automatic-renewal terms
- [x] Record termination-notice dates

## 2. Contract document repository

- [x] Secure Supabase Storage uploads
- [x] Attach agreements to contract records
- [x] Attach amendments and supporting files
- [x] Add document categories
- [x] Add document version history
- [x] Add controlled document downloads and deletion

## 3. Search and filtering

- [x] Search across companies, contacts, contracts, interactions, and follow-ups
- [x] Filter by owner
- [x] Filter by status
- [x] Filter by industry
- [x] Filter by relevant date ranges
- [x] Filter follow-ups by priority
- [x] Save commonly used views

## 4. Reporting

- [x] Report contract value by company
- [x] Report contract value by status
- [x] Show renewals grouped by month
- [x] Show interaction trends
- [x] Show follow-up completion trends
- [x] Identify companies with no recent contact

## 5. Governance

- [x] Add administrator role
- [x] Add manager role
- [x] Add contributor role
- [x] Add read-only role
- [x] Add record ownership
- [x] Add an audit trail of changes
- [x] Add restricted document access

## Later integrations

These are intentionally deferred until the core product is complete.

- [ ] Calendar synchronization
- [ ] Email integration
- [ ] Automated workflow notifications
- [ ] Advanced analytics or AI assistance

# ContractConnect

ContractConnect is a lightweight CRM for managing contracted companies, key contacts, contract terms, and relationship interactions.

Development progress is tracked in `PROJECT_ROADMAP.md`. Checklist items are marked complete only after implementation and verification.

Security design and operating controls are documented in `THREAT_MODEL.md` and `SECURITY_OPERATIONS.md`.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. The MVP stores changes in browser `localStorage`, so it works without a configured backend.

## Current MVP

- Relationship dashboard and renewal alerts
- Searchable company, contact, contract, and interaction views
- Company profiles with contacts, contracts, and activity history
- Add-company and log-interaction workflows
- Create, edit, and delete workflows for every CRM record type
- Automatic fictional demo-data seeding when the connected database is empty
- Responsive desktop and mobile navigation
- Persistent demo data with a reset option
- Account settings for display-name and password updates
- Persistent light/dark themes and selectable or uploaded profile pictures
- Dated, prioritized follow-up tasks with completion and overdue tracking
- CSV exports and blank migration templates for controlled data preparation

## Planned production architecture

The UI is ready to be connected to Supabase for PostgreSQL storage, authentication, role-based access, and file attachments.

## Supabase connection

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the project's SQL Editor.
3. Copy `.env.example` to `.env.local` and enter the project URL and anon key from Project Settings > API.
4. Run `supabase-auth-migration.sql` in the SQL Editor to add user profiles and the signup trigger.
5. In Authentication > Providers, keep Email enabled. Configure the Site URL and redirect URLs for your local and deployed addresses.
6. Create an account from the ContractConnect sign-up screen and confirm the email if confirmation is enabled.
7. Restart `npm run dev` after changing environment variables.

To enable follow-up tasks, also run `supabase-followups-migration.sql` in the SQL Editor. Fictional follow-up records are seeded automatically when the table is empty.

For the hardened production configuration, run all feature migrations followed by `supabase-security-hardening-migration.sql`. Keep `VITE_DEMO_MODE=false` and `VITE_ALLOW_PUBLIC_SIGNUP=false`, disable public sign-up in Supabase, and approve new members from Governance.

Run `npm run security:verify` before deployment. Once deployed, verify the live security headers with `npm run security:verify:deployment -- --url=https://your-production-host`.

Without these environment variables, ContractConnect remains in local demo mode. The sidebar shows the current connection state.

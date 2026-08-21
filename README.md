# ContractConnect

ContractConnect is a lightweight contract relationship management application. It combines company and contact records, contract lifecycle tracking, interaction history, follow-up tasks, document storage, reporting, governance, and audit trails in one React application backed by Supabase.

## Current status

The application is an MVP intended for controlled demonstrations and dedicated single-customer deployments. Shared multi-tenant hosting is not supported: each production customer must use a separate Supabase project until tenant-aware data isolation is implemented.

Implemented capabilities include:

- Company, contact, contract, interaction, and follow-up management
- Contract renewal windows and lifecycle status calculation
- Private contract documents with manager-restricted access
- Dashboard, search, filters, reports, CSV exports, and import templates
- Supabase authentication, profiles, roles, and workspace approval
- Audit logs and runtime security-event collection
- Runtime security guards, security headers, and WAF-as-code
- Scheduled repository and post-deployment security verification

See [Product overview](docs/product-overview.md) and [Product roadmap](PROJECT_ROADMAP.md) for scope and deferred integrations.

## Quick start

Prerequisites: Node.js 22 and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configure `.env.local` for either local demonstration or Supabase-backed development. Never commit this file.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_DEMO_MODE=true
VITE_ALLOW_PUBLIC_SIGNUP=true
```

Demo and public-signup flags must both be `false` in production.

## Validation

```powershell
npm run security:verify
npm run build
```

After deployment:

```powershell
npm run security:verify:deployment -- --url=https://your-production-host
```

## Documentation

- [Documentation index](docs/README.md)
- [Software requirements](docs/requirements.md)
- [Local development](docs/development.md)
- [Architecture](docs/architecture.md)
- [Supabase and database setup](docs/database.md)
- [Deployment guide](docs/deployment.md)
- [User guide](docs/user-guide.md)
- [Administrator guide](docs/admin-guide.md)
- [Testing and quality](docs/testing.md)
- [Operations runbook](docs/operations.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Security operations](SECURITY_OPERATIONS.md)
- [Threat model](THREAT_MODEL.md)
- [Contributing](CONTRIBUTING.md)

## Important security rules

- Use a dedicated Supabase project for every customer.
- Apply all SQL migrations in the documented order.
- Disable public sign-up in Supabase for production.
- Keep demo mode and public sign-up disabled in production environment variables.
- Treat RLS and Storage policies as the authorisation boundary; browser controls are not security controls.
- Do not upload production data until organisational approval, backup, monitoring, and access-review processes are in place.

## Licence

No open-source licence has been assigned. Treat the repository and its contents as private and proprietary unless the owner states otherwise.

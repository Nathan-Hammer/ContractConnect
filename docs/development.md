# Local development guide

## Prerequisites

- Node.js 22
- npm
- A modern browser
- A Supabase project when testing authenticated or persistent workflows
- Access to the Supabase SQL Editor for migrations

## Repository setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Vite prints the local address, normally `http://localhost:5173`.

## Environment modes

### Local demonstration

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_DEMO_MODE=true
VITE_ALLOW_PUBLIC_SIGNUP=true
```

Demo mode permits fictional seed data and exposes the administrator-only reset action. Use only a non-production Supabase project containing no approved information.

### Supabase-backed development

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_DEMO_MODE=false
VITE_ALLOW_PUBLIC_SIGNUP=false
```

When Supabase is configured and demo mode is false, CRM records are not cached in localStorage and demonstration data is not seeded automatically.

### Production

Production uses the same values as Supabase-backed development. The runtime fails closed if Supabase is missing or either security flag is true.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Produce the production bundle in `dist/` |
| `npm run preview` | Serve the production bundle locally |
| `npm run security:verify` | Run repository security assertions |
| `npm run security:verify:deployment -- --url=https://...` | Verify a deployed site and security headers |

## Source layout

```text
src/
  App.jsx                 Main application screens and workflows
  AuthScreen.jsx          Sign-in, recovery, and optional sign-up
  SecurityBoundary.jsx    Secure React render-failure boundary
  data.js                 Fictional demonstration dataset
  lib/
    auth.js               Supabase Authentication and profiles
    database.js           CRM persistence and data mapping
    documents.js          Contract document Storage operations
    governance.js         Team access and audit-log queries
    runtimeSecurity.js    Runtime configuration, telemetry, session guard
    supabase.js           Supabase client creation
  styles.css              Application styles and responsive layout
supabase commands/        Ordered SQL schema and feature migrations
scripts/                  Repository and deployment security verification
infra/cloudflare/         WAF-as-code
docs/                     Product, technical, user, and operational documentation
```

## Coding conventions

- Use functional React components except for error boundaries that require class lifecycle methods.
- Keep Supabase calls inside `src/lib/` modules rather than embedding persistence logic throughout components.
- Use database RLS as the authorisation boundary. UI visibility improves usability but is not sufficient security.
- Map database snake_case fields to application camelCase fields in one place.
- Never include the Supabase service-role key in browser code or a `VITE_` variable.
- Do not render untrusted HTML or introduce `dangerouslySetInnerHTML`.
- Sanitise and minimise security telemetry. Never log passwords, tokens, full URLs, document content, or whole customer records.
- Use `crypto.randomUUID()` for client-created record identifiers.
- Preserve accessible labels, button names, keyboard behaviour, and modal semantics.
- Update relevant documentation and the threat model when behaviour or trust boundaries change.

## Making a change

1. Identify the affected workflow, data model, roles, and trust boundaries.
2. Update `THREAT_MODEL.md` before coding if the change introduces a new data flow, integration, authentication mechanism, permission, or sensitive asset.
3. Add database changes as a new forward-only migration; do not silently rewrite migrations already applied to shared environments.
4. Implement the smallest cohesive application change.
5. Exercise affected roles directly against Supabase, not only through the UI.
6. Run security verification and the production build.
7. Update user, administrator, deployment, or operational documentation as appropriate.

## Definition of done

- Acceptance criteria are met.
- Empty, loading, error, and unauthorised states are handled.
- Database changes include constraints, indexes, RLS, and rollback/recovery consideration.
- No secrets or production data were added.
- `npm run security:verify` passes.
- `npm run build` passes.
- Manual tests cover affected roles and destructive operations.
- Documentation and threat model are current.


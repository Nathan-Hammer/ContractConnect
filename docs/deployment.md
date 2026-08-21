# Deployment guide

## Supported model

Deploy one ContractConnect frontend and one dedicated Supabase project per production customer. Do not point multiple customer frontends at one current-schema database.

## Pre-deployment requirements

- Customer and data owner identified
- Production Supabase project created
- SQL migrations applied in the documented order
- At least two approved administrative accounts where continuity requires it
- Public sign-up disabled in Supabase
- Email confirmation, redirect URLs, session, and rate-limit settings reviewed
- Production environment values stored in the hosting platform
- Backup tier selected and a restore test scheduled
- Security monitoring and incident ownership assigned
- Production hostname and TLS configured
- Security headers and WAF deployment planned

## Build configuration

```env
VITE_SUPABASE_URL=https://customer-project.supabase.co
VITE_SUPABASE_ANON_KEY=customer-publishable-key
VITE_DEMO_MODE=false
VITE_ALLOW_PUBLIC_SIGNUP=false
```

Never expose the Supabase service-role key through a `VITE_` variable. Vite embeds these variables in browser code.

Build and verify:

```powershell
npm ci --ignore-scripts
npm run security:verify
npm run build
npm audit --omit=dev --audit-level=high
```

Deploy the contents of `dist/` or use a hosting platform's Vite build integration.

## Security headers

- Vercel uses `vercel.json`.
- Cloudflare Pages, Netlify, and compatible static hosts can use `public/_headers`, copied into `dist/_headers` by Vite.
- Other hosts must reproduce the same headers in their native configuration.

The CSP currently allows application resources from the same origin and Supabase HTTPS/WebSocket endpoints. Update and test the CSP before adding integrations or third-party assets.

## Cloudflare WAF

Terraform under `infra/cloudflare/` defines managed OWASP/Cloudflare rules and custom sensitive-path blocking. Follow [Security operations](../SECURITY_OPERATIONS.md) to supply a zone ID and restricted API token, then run:

```powershell
terraform init
terraform plan
terraform apply
```

Review the plan before applying. Tune false positives using WAF event evidence. The application-host WAF does not automatically cover the separate Supabase hostname.

## Post-deployment verification

```powershell
npm run security:verify:deployment -- --url=https://production.example.com
```

Manually verify:

1. HTTPS redirect and canonical hostname
2. Sign-in, sign-out, recovery, and invitation flow
3. Inactive-account approval screen
4. Role matrix using separate accounts
5. CRM CRUD and audit entries
6. Manager-only document access and direct Storage denial
7. Production contains no demo seed or reset operation
8. CSP and WAF events reach assigned operators
9. Backup is current and recovery documentation is accessible

## GitHub continuous verification

The repository workflow runs on pull requests, `main`, daily schedule, and manual invocation. Configure:

- `PRODUCTION_URL` repository variable
- Branch protection requiring the repository-security job
- Dependabot reviewers
- Failure notifications
- Appropriate GitHub Actions permissions and retention

## Rollback

Frontend rollback is performed by redeploying the last approved immutable build. Database migrations are forward-only; prepare a recovery or compensating migration before production execution. For destructive or data-transforming changes, confirm the backup and restoration approach before applying them.

## Release record

Record:

- Release identifier and commit
- Customer environment
- Approver and deployer
- Build/security results
- Migration names and results
- Environment/configuration changes
- WAF or header changes
- Verification evidence
- Known issues and rollback point


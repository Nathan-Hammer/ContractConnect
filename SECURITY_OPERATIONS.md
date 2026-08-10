# ContractConnect Security Operations

This guide turns the repository security controls into an operating production control set. The threat model is maintained in `THREAT_MODEL.md`.

## Control coverage

| Concept | Repository implementation | External action still required |
|---|---|---|
| Threat modeling before coding | Versioned STRIDE threat model, abuse cases, risk register, and review triggers | Review the model during design and require security approval for accepted high risks |
| Runtime application self-protection | Secure production configuration assertions, React security boundary, session revalidation, CSP violation/runtime event reporting, inactive-account gate, server-side RLS | A traditional RASP agent requires a supported server/API runtime; select one if strict RASP certification is required |
| Continuous verification | Repository verifier, post-deployment verifier, scheduled GitHub workflow, dependency audit, Dependabot | Configure GitHub `PRODUCTION_URL`, notification routing, and branch protection |
| Web Application Firewall | Cloudflare managed/custom WAF Terraform and portable security headers | Put the production hostname behind Cloudflare, apply Terraform, review events, and tune false positives |

## Required Supabase deployment

Run `supabase commands/supabase-security-hardening-migration.sql` after all previous migrations. It:

- Activates existing profiles to avoid locking out the current team.
- Makes all newly created profiles inactive and Read-only.
- Requires active membership in CRM and document RLS policies.
- Allows managers to list profiles and administrators to approve access.
- Protects role and activation fields with a database trigger.
- Adds a sanitised `security_events` table for runtime telemetry.

After the migration, verify one user for every role. Public sign-up should also be disabled in the Supabase Authentication settings. The application flag hides the sign-up UI, but the provider setting is the authoritative control.

## Production environment

Set these values in the deployment platform:

```text
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
VITE_DEMO_MODE=false
VITE_ALLOW_PUBLIC_SIGNUP=false
```

The runtime intentionally refuses to start a production build when Supabase is missing, demo mode is enabled, or public sign-up is enabled.

## WAF deployment

The configuration in `infra/cloudflare` deploys:

- Cloudflare Managed Ruleset
- Cloudflare OWASP Core Ruleset at paranoia level 2
- Custom blocking for environment, source-control, SQL, backup, and Terraform-state paths

Prerequisites:

1. Place the ContractConnect production hostname behind a proxied Cloudflare DNS record.
2. Use a Cloudflare plan that includes the configured managed rulesets.
3. Create an API token with `Zone WAF Write` for the target zone.
4. Keep the token outside the repository and expose it as `CLOUDFLARE_API_TOKEN` only while applying Terraform.
5. Copy `terraform.tfvars.example` to an untracked `terraform.tfvars` and set the zone ID.

Run from `infra/cloudflare`:

```text
terraform init
terraform plan
terraform apply
```

Review WAF events in log mode where available before enforcing new or customised rules. The WAF on the application hostname does not automatically protect the separate `*.supabase.co` API hostname. Continue to treat Supabase RLS, Authentication configuration, Storage policies, quotas, and rate limits as mandatory controls. A Supabase custom domain routed through an approved edge architecture requires separate design and testing.

## Continuous verification setup

The workflow `.github/workflows/security-verification.yml` runs on pull requests, changes to `main`, daily, and manual dispatch. Configure:

- Repository variable `PRODUCTION_URL` with the canonical HTTPS application address.
- Branch protection requiring the `repository-security` check.
- Notifications for failed scheduled workflows.
- Dependabot reviewers and a remediation service level.

Local checks:

```text
npm run security:verify
npm run build
npm run security:verify:deployment -- --url=https://contractconnect.example.com
```

## Runtime monitoring

The frontend reports sanitised events to `security_events` for:

- Content Security Policy violations
- Unhandled promise rejections
- Window/runtime errors
- React render failures
- Session-verification failures
- Profile load/missing-profile failures
- Team activation and deactivation

Do not add passwords, access tokens, document contents, query strings, or full customer records to event context. Configure an external monitor or scheduled database job to alert on `high` and `critical` events; storing events without alerting is not continuous protection.

## RASP boundary

The current React application is static browser code and Supabase is a managed backend. A conventional RASP agent normally instruments a server runtime such as Java, .NET, Node.js, or a supported API gateway. The implemented controls provide runtime detection, secure failure, continuous session validation, and server-enforced data access, but they should be described as **RASP-aligned runtime protection**, not as a third-party certified RASP product.

If a procurement or regulatory requirement demands formal RASP, introduce a supported backend-for-frontend/API gateway and select a RASP vendor that can instrument that runtime. Re-run the threat model before making that architecture change.


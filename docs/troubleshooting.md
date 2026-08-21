# Troubleshooting

## Application will not start in production

The runtime deliberately stops when production is insecure. Confirm:

```env
VITE_SUPABASE_URL=<configured>
VITE_SUPABASE_ANON_KEY=<configured>
VITE_DEMO_MODE=false
VITE_ALLOW_PUBLIC_SIGNUP=false
```

Rebuild after changing Vite variables; they are embedded at build time.

## “Access awaiting approval”

Authentication succeeded, but `profiles.is_active` is false. An Administrator must open Governance, choose the least-privilege role, and approve access.

If no Administrator can enter the application, use a controlled Supabase SQL recovery procedure to activate the authorised profile and record the change. Investigate why administrative continuity failed.

## New sign-up fails after governance changes

Confirm `supabase-security-hardening-migration.sql` was applied. It changes the default role to Read-only and updates the user-creation trigger to insert a valid inactive profile.

## Governance shows only the current user

Apply the security-hardening migration. It adds the Manager/Administrator profile SELECT policy required by the team query.

## Record save or deletion is rejected

- Confirm the profile is active.
- Confirm the role is Administrator, Manager, or Contributor.
- Inspect the Supabase error and RLS policies.
- Do not assume a visible UI control implies database permission.
- For Read-only users, rejection is expected.

## Documents do not appear

- Confirm document migrations were applied before governance and hardening.
- Confirm the private `contract-documents` bucket exists.
- Check role and access level.
- Test metadata and Storage access separately.
- Check that the Storage object still exists if a prior deletion partially failed.

## Upload is rejected

Accepted types: PDF, Word, JPEG, PNG. Maximum size: 20 MB. Verify the file's actual type, Storage bucket restrictions, role, and active state.

## Runtime security events are missing

- Confirm the security-hardening migration created `security_events`.
- Confirm the user is authenticated.
- Check browser console for a safe telemetry warning.
- Confirm RLS permits the event actor to insert their own record.
- Remember that offline errors cannot reach Supabase.

## Security headers fail deployment verification

- Confirm the deployed host supports `vercel.json` or `_headers`.
- Inspect the live response, not only repository configuration.
- Check CDN caching after changes.
- Ensure redirects also emit appropriate security headers.
- Update CSP deliberately when adding a new trusted endpoint; do not broadly weaken it.

## WAF configuration is present but inactive

Repository files do not deploy themselves. Confirm:

- Production hostname is proxied through Cloudflare.
- Terraform is installed.
- `CLOUDFLARE_API_TOKEN` has restricted `Zone WAF Write` access.
- `cloudflare_zone_id` is configured outside source control.
- `terraform plan` and `terraform apply` completed.
- Rules appear in Cloudflare WAF and produce events.

## Scheduled verification is not running

- Confirm the repository is published to GitHub.
- Enable GitHub Actions.
- Configure the `PRODUCTION_URL` repository variable.
- Check scheduled workflows are not disabled due to inactivity.
- Configure branch protection and failure notifications.

## Build failure

Run:

```powershell
npm ci --ignore-scripts
npm run security:verify
npm run build
```

Use Node.js 22. Do not delete or rewrite user work to resolve dependency issues. Capture the first meaningful error and confirm dependency versions match `package-lock.json`.

## Supabase connection state shows unavailable

- Confirm the project URL and publishable/anonymous key.
- Restart Vite after environment changes.
- Verify project availability and browser network errors.
- Confirm CSP `connect-src` permits the Supabase domain.
- Confirm the project has not exceeded quotas or paused.


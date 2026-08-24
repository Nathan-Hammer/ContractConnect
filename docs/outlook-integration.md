# Microsoft Outlook integration runbook

## Status

The calendar connector is implemented in code but is not operational until the database migration, Entra registration, Edge Function secrets, function deployment, and role-based acceptance tests are completed. Mail consent is supported, but mailbox synchronization and UI are not yet implemented.

## Entra ID application

Use a dedicated, single-tenant Entra application for the ContractConnect Outlook connector. Do not reuse the Supabase Microsoft sign-in registration; connector permissions and credential rotation have a different lifecycle.

1. Create an app registration named `ContractConnect Outlook Connector`.
2. Record its Directory (tenant) ID and Application (client) ID.
3. Add this Web redirect URI exactly:
   `https://gpwlgxamnhqwbxzhsshw.supabase.co/functions/v1/outlook-oauth-callback`
4. Add delegated Microsoft Graph permissions:
   - `User.Read`
   - `Calendars.Read`
   - `Mail.Read`
5. Grant tenant administrator consent if organisational consent policy requires it.
6. Create a client secret with the shortest operationally practical lifetime and record its expiry in the credential-rotation register.
7. Limit user assignment to the approved pilot group when the enterprise application is configured to require assignment.

The application requests `openid`, `profile`, `email`, and `offline_access` at runtime, plus only the Graph features selected by the user.

## Supabase deployment

1. Run `supabase-outlook-integration-migration.sql` in the Supabase SQL Editor.
2. Generate a cryptographically random 32-byte key and Base64 encode it. Store it as `OUTLOOK_TOKEN_ENCRYPTION_KEY`; never commit or send it through chat or email.
3. Configure these Edge Function secrets:

| Secret | Value |
|---|---|
| `OUTLOOK_TENANT_ID` | Entra directory ID |
| `OUTLOOK_CLIENT_ID` | Connector application ID |
| `OUTLOOK_CLIENT_SECRET` | Connector client credential |
| `OUTLOOK_REDIRECT_URI` | Exact callback URI registered above |
| `OUTLOOK_TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte encryption key |
| `CONTRACTCONNECT_APP_ORIGIN` | Exact application origin, without a trailing slash |

For local testing, the application origin is normally `http://localhost:5173`. Change it to the HTTPS production origin before production deployment. A single deployment currently supports one allowed application origin.

4. Deploy `outlook-oauth-start`, `outlook-oauth-callback`, and `outlook-api`. The callback must use the repository `supabase/config.toml`, which disables JWT verification only for that public OAuth return endpoint. The other two functions must retain JWT verification.
5. Never deploy any function with global `--no-verify-jwt`. The callback is the only unauthenticated endpoint and validates a one-time, ten-minute state value plus PKCE.

## Acceptance tests

1. A signed-out caller cannot invoke the start or API functions.
2. An inactive ContractConnect user cannot connect Outlook.
3. Selecting Calendar only requests Calendar access and displays real events from that user's default calendar.
4. Selecting Email only does not enable the dashboard calendar.
5. Selecting both updates the recorded scope metadata.
6. A cancelled or expired consent attempt does not create credentials.
7. Disconnect removes stored credentials and calendar retrieval stops.
8. Expired access tokens refresh without user interaction.
9. A revoked or expired refresh token produces a visible connection error without exposing token content.
10. Audit logs show connection lifecycle metadata but never credential values.

## Known production gaps

- Disconnect deletes ContractConnect's credential copy but does not perform tenant-wide Microsoft session revocation. Users or administrators can additionally revoke enterprise-app consent in Microsoft when required.
- Mailbox reading/synchronization is not implemented yet; `Mail.Read` consent alone does not provide a user-facing email feature.
- The connector currently reads the default calendar on demand. Background synchronization, change notifications, shared mailboxes, delegated calendars, retention, and eDiscovery requirements are not implemented.
- Secrets require documented rotation, incident response, backup exclusions, and production monitoring.

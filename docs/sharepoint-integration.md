# SharePoint read-only contract integration

## Scope and design

ContractConnect lists files on demand from the configured SharePoint Project Contracts folder and opens the original SharePoint `webUrl`. It does not copy file contents to Supabase, cache documents in the browser, upload, edit, delete, or change SharePoint permissions.

The integration uses each user's existing delegated Microsoft connection. SharePoint remains responsible for determining whether that user may open a file.

## Microsoft Entra configuration

In the existing ContractConnect connector app registration:

1. Open **API permissions** and add Microsoft Graph delegated permission `Sites.Read.All`.
2. Grant administrator consent according to the tenant's consent policy.
3. Do not add `Sites.ReadWrite.All`, `Files.ReadWrite`, or `Mail.Send`; they are not required.
4. Keep the existing `User.Read`, `Calendars.Read`, and `Mail.Read` permissions for the already implemented Outlook features.
5. Confirm the Enterprise Application remains limited to the approved ContractConnect pilot users.

`Sites.Read.All` can expose metadata and content from sites that the signed-in user can access. This is broader than a single folder. The application code only calls the configured site/library/folder, but Entra consent itself is not folder-scoped. This residual risk requires managerial/data-owner approval.

## Supabase configuration

1. Run `supabase commands/supabase-sharepoint-readonly-migration.sql`.
2. Add these Edge Function secrets using the actual SharePoint names:

```text
SHAREPOINT_SITE_HOST=schoemans.sharepoint.com
SHAREPOINT_SITE_PATH=/sites/DigitalSolutions
SHAREPOINT_DRIVE_NAME=Digidocs
SHAREPOINT_FOLDER_PATH=Project Contracts
```

The code contains these values as development defaults, but production must set them explicitly so a future code change cannot silently point at the wrong repository.

3. Redeploy the functions whose OAuth and Graph behavior changed:

```powershell
npx supabase functions deploy outlook-oauth-start
npx supabase functions deploy outlook-oauth-callback
npx supabase functions deploy outlook-api
```

The callback's JWT exception remains scoped through `supabase/config.toml`. Do not use a global `--no-verify-jwt` deployment option.

## User reconnection

Existing tokens do not automatically acquire the new SharePoint permission.

1. Open **Account settings → Integrations**.
2. Retain the Outlook Email and Calendar selections if still required.
3. Select **SharePoint contracts**.
4. Select **Update permissions** and complete Microsoft consent.
5. Open **Documents**. ContractConnect retrieves files from SharePoint on entry.

## Production acceptance test

1. An unconnected user cannot call the SharePoint action.
2. A connected but inactive ContractConnect user receives no data.
3. A pilot user with SharePoint access sees the expected Project Contracts files.
4. A user without SharePoint access cannot open restricted files.
5. The screen offers no delete action for SharePoint documents.
6. Opening a document sends the user to the original SharePoint URL.
7. Browser storage, Supabase tables, and logs contain no file content or Microsoft access token.
8. Removing SharePoint permission or disconnecting Microsoft stops retrieval.
9. Confirm the configured library's Graph display name. If it is not exactly `Digidocs`, update `SHAREPOINT_DRIVE_NAME`.

## Current limitations

- The folder listing is non-recursive; files in nested subfolders are not displayed yet.
- At most 500 files are returned per request.
- Files are not automatically matched to ContractConnect contract records because no approved matching key has been defined.
- SharePoint changes appear the next time the Documents screen is opened or the connection is refreshed; there is no background synchronization or webhook.
- `Sites.Read.All` delegated consent is broader than the configured folder. A later app-only design using selected permissions could reduce that scope, but would require SharePoint administrator assignment and a different service-to-service security model.


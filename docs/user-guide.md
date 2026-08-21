# User guide

## Signing in

1. Open the ContractConnect address provided by your administrator.
2. Enter your work email address and password.
3. Complete email verification if requested.
4. If the approval screen appears, your identity exists but an administrator has not activated workspace access.

Use **Forgot password?** to request a recovery email. Recovery links work only for redirect URLs approved in Supabase.

## Navigation

The sidebar provides:

- **Overview:** portfolio summary, recent interactions, renewals, and follow-ups
- **Companies:** company register and relationship profiles
- **Contacts:** people linked to companies
- **Contracts:** contract lifecycle and renewal windows
- **Documents:** agreements and supporting files
- **Interactions:** chronological relationship activity
- **Follow-ups:** upcoming, overdue, and completed tasks
- **Reports:** contract and relationship reporting

Use the profile menu for account settings, data management, governance (authorised roles), and sign-out.

## Overview

The welcome banner uses your profile name. Summary cards show contracted companies, active contract value, key contacts, and renewals due. You can:

- Log an interaction
- Open a company from recent activity
- Review an expiring contract
- Create or complete follow-ups

Lifecycle status is calculated from the contract dates and renewal notice period, so it may differ from the originally stored status as time passes.

## Companies

Use **Add company** to capture name, industry, location, status, website, phone, owner, and notes. The company register can be filtered by status, industry, and owner.

**Save view** stores the current company filters in the current browser only. It does not synchronise between users or devices.

Opening a company shows its contacts, contracts, and interaction history. Deleting a company also removes related contacts, contracts, interactions, follow-ups, document metadata, and stored documents through database relationships and application operations. Treat deletion as irreversible unless restored from backup.

## Contacts

Contacts must belong to a company. Record their name, job title, email, phone, and whether they are the primary contact. Email and phone links can open the device's configured mail or calling application.

## Contracts

Capture:

- Company and title
- Contract value in NAD
- Start and end dates
- Stored status
- Renewal-notice period
- Automatic-renewal indicator
- Termination-notice date

Use the 30-, 60-, and 90-day controls to review upcoming expiries. ContractConnect recalculates **Active**, **Expiring soon**, and **Expired** from the current date.

## Documents

Upload PDF, Word, JPEG, or PNG files up to 20 MB. Select a contract, category, manual version number, and access level.

- **All team:** available to active workspace members
- **Managers only:** available to Managers and Administrators

Downloads use a temporary signed link. Version numbers are labels entered by the uploader; the application does not automatically link, compare, or restore versions.

Do not upload executable files, credentials, or unapproved information. Malware scanning is not currently built in.

## Interactions

Log a call, meeting, email summary, or note. Select the company, optional contact, date, summary, and notes. This is an activity record; ContractConnect does not send or synchronise emails.

## Follow-ups

Create a task with a company, optional contact, title, due date, and priority. Open tasks become overdue when the due date passes. Use the completion control to close or reopen a task.

ContractConnect currently shows reminders in the interface; it does not send automated notifications.

## Search and reports

Global search covers companies, contacts, contracts, interactions, follow-ups, and document names. Results navigate to the relevant area rather than opening every record directly.

Reports cover:

- Total portfolio value
- Contract value by company and lifecycle status
- Renewals by month
- Interaction trend
- Follow-up completion
- Companies without contact in the last 30 days

Reports are operational views, not audited financial statements.

## Data export

Data management provides CSV exports and blank preparation templates. Exported files leave ContractConnect's access controls. Store, share, and dispose of them according to organisational information-handling rules.

The interface does not currently import completed templates.

## Account settings

You may update your display name, password, avatar, and theme. Avatar images are stored in a public bucket; use an appropriate non-sensitive image.

Always sign out on a shared device.

## Permission errors

If a control is visible but an operation is rejected, the database permission is authoritative. Contact an administrator rather than repeatedly retrying or attempting to bypass the restriction.


# Contributing to ContractConnect

## Principles

- Protect customer confidentiality before convenience.
- Make small, reviewable changes with a clear purpose.
- Keep database authorisation server-side.
- Treat documentation, migrations, tests, and operational impact as part of the feature.
- Preserve unrelated work in the repository.

## Workflow

1. Create or link an issue describing the problem, acceptance criteria, affected roles, and data impact.
2. Review `THREAT_MODEL.md` before changes involving authentication, permissions, data flows, documents, exports, integrations, or deployment.
3. Create a focused branch.
4. Implement code and forward-only migrations.
5. Update relevant documentation.
6. Run:

   ```powershell
   npm run security:verify
   npm run build
   npm audit --omit=dev --audit-level=high
   ```

7. Complete manual role and workflow tests.
8. Open a pull request with test evidence, migration order, security impact, and rollback/recovery notes.

## Pull request checklist

- [ ] Scope and acceptance criteria are clear.
- [ ] No credentials, production data, or customer exports are included.
- [ ] Threat-model impact was reviewed and documented.
- [ ] New tables/columns have constraints, indexes, and RLS where appropriate.
- [ ] UI permission changes have matching server-side enforcement.
- [ ] Error, loading, empty, and unauthorised states are handled.
- [ ] Accessibility and responsive behaviour were checked.
- [ ] Security verification and production build pass.
- [ ] Role-matrix and destructive-operation tests were completed.
- [ ] Documentation is current.
- [ ] Deployment, migration, monitoring, and rollback impacts are stated.

## Database changes

- Add a new migration rather than changing an already applied migration.
- Make privileges explicit and least-privilege.
- Set `search_path` on `security definer` functions.
- Test with anonymous, inactive, Read-only, Contributor, Manager, and Administrator contexts.
- Include a backfill and recovery plan when changing existing data.

## Security reporting

Do not place suspected vulnerabilities containing sensitive details in a public issue. Notify the repository owner or designated security contact privately. Preserve evidence and avoid testing against production customer data without written authority.

## Commit and review quality

- Use descriptive commits that explain the intent.
- Keep formatting-only changes separate from behavioural changes when practical.
- Do not mix unrelated refactoring into a security or bug fix.
- Review generated files and dependency-lock changes intentionally.
- Require at least one qualified reviewer for authentication, RLS, Storage, WAF, or migration changes.


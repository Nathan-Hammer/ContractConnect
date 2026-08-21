import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []
const checks = []

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  checks.push(message)
  if (!condition) failures.push(message)
}
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.join(dir, entry.name)
  return entry.isDirectory() ? walk(relative) : [relative]
})

const packageJson = JSON.parse(read('package.json'))
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
assert(!Object.values(dependencies).includes('latest'), 'Dependencies are pinned instead of using latest')
assert(Boolean(packageJson.scripts['security:verify']), 'A repository security verification command exists')
assert(Boolean(packageJson.scripts['security:verify:deployment']), 'A post-deployment verification command exists')

const threatModel = read('THREAT_MODEL.md')
for (const section of ['Trust boundaries', 'STRIDE threat register', 'Prioritised treatment plan', 'Security verification plan']) {
  assert(threatModel.includes(section), `Threat model contains ${section}`)
}

const requiredDocumentation = [
  'README.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/product-overview.md',
  'docs/requirements.md',
  'docs/user-guide.md',
  'docs/admin-guide.md',
  'docs/development.md',
  'docs/architecture.md',
  'docs/database.md',
  'docs/deployment.md',
  'docs/testing.md',
  'docs/operations.md',
  'docs/troubleshooting.md',
  'docs/adr/0001-dedicated-customer-deployments.md',
  'SECURITY_OPERATIONS.md',
]
requiredDocumentation.forEach((file) => assert(fs.existsSync(path.join(root, file)), `Required documentation exists: ${file}`))

const markdownFiles = [...walk('docs'), 'README.md', 'CONTRIBUTING.md', 'SECURITY_OPERATIONS.md', 'THREAT_MODEL.md', 'PROJECT_ROADMAP.md']
  .filter((file) => file.endsWith('.md'))
for (const file of markdownFiles) {
  const links = [...read(file).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
  for (const link of links) {
    if (/^(https?:|mailto:|#)/i.test(link)) continue
    const target = decodeURIComponent(link.split('#')[0])
    assert(fs.existsSync(path.resolve(root, path.dirname(file), target)), `Local documentation link resolves: ${file} -> ${target}`)
  }
}

const sourceText = walk('src').filter((file) => /\.(js|jsx)$/.test(file)).map(read).join('\n')
assert(!sourceText.includes('dangerouslySetInnerHTML'), 'Application does not render raw HTML')
assert(!/service[_-]?role/i.test(sourceText), 'No Supabase service-role credential is referenced by browser code')
assert(sourceText.includes('installRuntimeProtection'), 'Runtime protection is installed at application startup')
assert(sourceText.includes('startSessionGuard'), 'Authenticated sessions are revalidated at runtime')

const gitignore = read('.gitignore')
assert(gitignore.split(/\r?\n/).includes('.env.local'), '.env.local is excluded from source control')

const envExample = read('.env.example')
assert(envExample.includes('VITE_DEMO_MODE=false'), 'Demo mode defaults to false')
assert(envExample.includes('VITE_ALLOW_PUBLIC_SIGNUP=false'), 'Public sign-up defaults to false')

const hardeningSql = read(path.join('supabase commands', 'supabase-security-hardening-migration.sql'))
for (const requirement of ['is_active boolean', "alter column role set default 'Read-only'", 'Active team reads', 'security_events', 'protect_profile_security_fields']) {
  assert(hardeningSql.includes(requirement), `Security migration includes ${requirement}`)
}

const vercel = JSON.parse(read('vercel.json'))
const headerNames = new Set(vercel.headers.flatMap((entry) => entry.headers.map((header) => header.key.toLowerCase())))
for (const header of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
  assert(headerNames.has(header), `Deployment headers include ${header}`)
}

assert(fs.existsSync(path.join(root, 'infra', 'cloudflare', 'waf.tf')), 'Cloudflare WAF configuration exists')
assert(fs.existsSync(path.join(root, '.github', 'workflows', 'security-verification.yml')), 'Continuous security verification workflow exists')

if (failures.length) {
  console.error(`Security verification failed (${failures.length}/${checks.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Security verification passed: ${checks.length} controls checked.`)

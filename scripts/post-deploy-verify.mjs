const urlArg = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6)
const target = urlArg || process.env.PRODUCTION_URL

if (!target || !/^https:\/\//i.test(target)) {
  console.error('Provide an HTTPS deployment using --url=https://example.com or PRODUCTION_URL.')
  process.exit(1)
}

const response = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(15000) })
if (!response.ok) throw new Error(`Deployment returned HTTP ${response.status}`)

const requiredHeaders = {
  'content-security-policy': ['default-src', 'frame-ancestors'],
  'strict-transport-security': ['max-age='],
  'x-content-type-options': ['nosniff'],
  'referrer-policy': [],
  'permissions-policy': [],
}

const failures = []
for (const [name, fragments] of Object.entries(requiredHeaders)) {
  const value = response.headers.get(name)
  if (!value) failures.push(`Missing ${name}`)
  else fragments.forEach((fragment) => { if (!value.toLowerCase().includes(fragment)) failures.push(`${name} is missing ${fragment}`) })
}

const html = await response.text()
if (!html.includes('ContractConnect')) failures.push('Expected ContractConnect application marker was not found')
if (html.includes('/src/main.jsx')) failures.push('Development entry point is exposed in the deployment')

if (failures.length) {
  console.error('Post-deployment security verification failed:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Post-deployment security verification passed for ${target}`)


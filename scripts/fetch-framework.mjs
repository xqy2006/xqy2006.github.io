/**
 * Put ProseOS into the working tree so this site can be built.
 *
 * The framework is private and this repository is public, so it is fetched at
 * build time rather than committed. Nothing it writes is tracked — see the
 * fetched-framework block in .gitignore — and the built output carries no
 * source maps, so a deploy publishes the site and not the framework.
 *
 *   node scripts/fetch-framework.mjs ../proseos   # from a checkout you have
 *   PROSEOS_TOKEN=ghp_… node scripts/fetch-framework.mjs
 *
 * The second form is what Vercel and the workflows use.
 */
import { cp, rm, stat, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { argv, env, exit } from 'node:process'

const run = promisify(execFile)

/** Replaced wholesale on every fetch. Everything else here is the blog's. */
const PATHS = [
  'src',
  'build',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'public/fonts',
  'public/favicon.svg',
]

const REPO = env.PROSEOS_REPO ?? 'xqy2006/proseos'
const REF = env.PROSEOS_REF ?? 'main'
const CLONE = '.framework'

const exists = async (p) => !!(await stat(p).catch(() => null))

async function source() {
  const given = argv[2]
  if (given) return given
  const token = env.PROSEOS_TOKEN
  if (!token) {
    console.error('no path given and PROSEOS_TOKEN is not set.\n' +
      'Pass a checkout: node scripts/fetch-framework.mjs ../proseos')
    exit(2)
  }
  await rm(CLONE, { recursive: true, force: true })
  // The token is passed in the URL, which git keeps out of its own output;
  // nothing here echoes the command.
  await run('git', ['clone', '--depth', '1', '--branch', REF,
    `https://x-access-token:${token}@github.com/${REPO}.git`, CLONE])
  return CLONE
}

const from = await source()

if (!(await exists(join(from, 'src/main.ts')))) {
  console.error(`${from} does not look like a ProseOS checkout`)
  exit(2)
}

for (const path of PATHS) {
  const src = join(from, path)
  if (!(await exists(src))) {
    console.error(`  missing in source, skipped: ${path}`)
    continue
  }
  await rm(path, { recursive: true, force: true })
  await cp(src, path, { recursive: true })
  console.log(`  ${path}`)
}

// The blog declares its own dependencies so that `npm ci` and build caching
// work normally. Say so when the framework has moved on from them.
const mine = JSON.parse(await readFile('package.json', 'utf8'))
const theirs = JSON.parse(await readFile(join(from, 'package.json'), 'utf8'))
const declared = { ...mine.dependencies, ...mine.devDependencies }
// Runtime dependencies must all be here or the build cannot run. Dev ones
// only matter where this repo already has an opinion: the framework's test
// runner and browser are its business, not the blog's.
for (const [name, want] of Object.entries(theirs.dependencies ?? {})) {
  if (!declared[name]) console.error(`  package.json: ProseOS needs ${name}@${want}, this repo has none`)
  else if (declared[name] !== want) console.error(`  package.json: ProseOS wants ${name}@${want}, this repo pins ${declared[name]}`)
}
for (const [name, want] of Object.entries(theirs.devDependencies ?? {})) {
  if (declared[name] && declared[name] !== want) {
    console.error(`  package.json: ProseOS wants ${name}@${want}, this repo pins ${declared[name]}`)
  }
}

if (from === CLONE) await rm(CLONE, { recursive: true, force: true })
console.log(`\nfetched ${REPO}@${REF}. \`npm run build\` will say whether site.config.ts still satisfies SiteConfig.`)

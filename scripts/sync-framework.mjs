/**
 * Copy ProseOS into this repository.
 *
 * The framework is vendored rather than installed, because the deploy that
 * serves this site builds straight from the repo and should never need
 * credentials for somewhere else. That makes updating a copy, and this is it.
 *
 *   node scripts/sync-framework.mjs ../proseos
 *
 * Everything under PATHS is replaced wholesale. Everything else — content/,
 * site.config.ts, public/img, the verification files, this script — is left
 * alone, so a sync never touches the blog itself.
 */
import { cp, rm, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { argv, exit } from 'node:process'

const PATHS = [
  'src',
  'build',
  'tests',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  '.editorconfig',
  'public/fonts',
  'public/favicon.svg',
  'scripts/fetch-fonts.mjs',
]

const from = argv[2]
if (!from) {
  console.error('usage: node scripts/sync-framework.mjs <path-to-proseos>')
  exit(2)
}

const exists = async (p) => !!(await stat(p).catch(() => null))

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

console.log('\nsynced. `npm run build` will say whether site.config.ts still satisfies SiteConfig.')

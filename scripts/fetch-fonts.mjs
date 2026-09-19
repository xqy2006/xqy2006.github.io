#!/usr/bin/env node
/**
 * Fetch Maple Mono CN and split it into unicode-range chunks.
 *
 * The upstream release ships every format and weight in one ~134 MB zip; we
 * keep two woff2 files and let cn-font-split shard them, so a reader loading a
 * Latin-only page never downloads a Chinese glyph.
 *
 *   node scripts/fetch-fonts.mjs          # regular + bold
 *   node scripts/fetch-fonts.mjs --skip-split
 */
import { mkdirSync, existsSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = join(ROOT, '.cache/fonts')
const OUT = join(ROOT, 'public/fonts/cn')
const GEN = join(ROOT, 'public/fonts/cn/faces.css')
// The CN release ships TTF only; cn-font-split converts to woff2 while sharding.
const WANT = ['MapleMono-CN-Regular.ttf', 'MapleMono-CN-Bold.ttf']

const log = (...a) => console.log('[fonts]', ...a)

async function latestAsset() {
  const res = await fetch('https://api.github.com/repos/subframe7536/maple-font/releases/latest')
  if (!res.ok) throw new Error(`github api ${res.status}`)
  const rel = await res.json()
  const asset = rel.assets.find((a) => a.name === 'MapleMono-CN-unhinted.zip')
    ?? rel.assets.find((a) => a.name === 'MapleMono-CN.zip')
  if (!asset) throw new Error('no MapleMono-CN zip in the latest release')
  return { url: asset.browser_download_url, name: asset.name, size: asset.size, tag: rel.tag_name }
}

async function main() {
  mkdirSync(TMP, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  const asset = await latestAsset()
  const zip = join(TMP, asset.name)
  log(`release ${asset.tag}, ${asset.name} (${(asset.size / 1048576).toFixed(0)} MB)`)

  // A download interrupted halfway leaves a file that exists but is short.
  // Without this the partial zip is reused on every later run and fails in a
  // way that points at the wrong thing.
  const cached = existsSync(zip) && statSync(zip).size === asset.size
  if (cached) {
    log('using cached zip')
  } else {
    if (existsSync(zip)) log('cached zip is the wrong size; downloading again')
    log('downloading…')
    const res = await fetch(asset.url)
    if (!res.ok) throw new Error(`download ${res.status}`)
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  }

  const extracted = join(TMP, 'x')
  rmSync(extracted, { recursive: true, force: true })
  mkdirSync(extracted, { recursive: true })
  for (const want of WANT) {
    try {
      execFileSync('unzip', ['-o', '-j', zip, `*${want}`, '-d', extracted], { stdio: 'pipe' })
    } catch (err) {
      // Saying "not in the archive" when unzip is simply missing sends people
      // looking in the wrong place.
      if (err?.code === 'ENOENT') {
        throw new Error('this script needs `unzip` on your PATH (apt install unzip, brew install unzip)')
      }
      log(`! ${want} not found in the archive, skipping`)
    }
  }
  const found = readdirSync(extracted).filter((f) => WANT.includes(f))
  if (!found.length) throw new Error('no font files extracted; the release layout may have changed')
  log(`extracted ${found.join(', ')}`)

  if (process.argv.includes('--skip-split')) {
    log('--skip-split: copying whole TTFs (large; prefer the split path)')
    for (const f of found) writeFileSync(join(OUT, f), readFileSync(join(extracted, f)))
    writeFileSync(GEN, found.map((f) => `@font-face {
  font-family: 'Maple Mono';
  font-style: normal;
  font-weight: ${f.includes('Bold') ? 700 : 400};
  font-display: swap;
  src: url('${f}') format('woff2');
  unicode-range: U+2E80-9FFF, U+3000-303F, U+FF00-FFEF, U+4E00-9FFF;
}`).join('\n\n') + '\n')
    log(`wrote ${GEN}`)
    return
  }

  const css = []
  for (const f of found) {
    const weight = f.includes('Bold') ? 700 : 400
    const dest = join(OUT, weight === 700 ? 'bold' : 'regular')
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    log(`splitting ${f} → public/fonts/cn/${weight === 700 ? 'bold' : 'regular'}`)
    execFileSync('npx', [
      '--yes', 'cn-font-split@7', 'run',
      '-i', join(extracted, f),
      '-o', dest,
      '--css.fontFamily', 'Maple Mono',
      '--css.fontWeight', String(weight),
      '--css.fontDisplay', 'swap',
      '--css.commentUnicodes', 'false',
      '--testHtml', 'false',
      '--reporter', 'false',
      '--chunkSize', '400000',
    ], { stdio: 'inherit' })
    const generated = join(dest, 'result.css')
    if (!existsSync(generated)) throw new Error(`cn-font-split produced no result.css in ${dest}`)
    // Rebase relative URLs: the CSS is concatenated into src/styles/, but the
    // shards are served from public/fonts/cn/<weight>/.
    const dir = weight === 700 ? 'bold' : 'regular'
    css.push(
      readFileSync(generated, 'utf8')
        .replace(/url\((["']?)\.?\/?([^)"']+)\1\)/g, `url('${dir}/$2')`),
    )
  }
  writeFileSync(GEN, `/* generated by scripts/fetch-fonts.mjs — do not edit */\n${css.join('\n')}\n`)
  log(`wrote ${GEN}`)
}

main().catch((err) => {
  console.error('[fonts] failed:', err.message)
  process.exitCode = 1
})

import { defineCommand, type Command, type Ctx } from '../core/registry.js'
import { loadPython, isReady, pythonVersion, mountDocs, prepare, execute, type PyodideApi } from '../runtime/python.js'

/**
 * Python is a guest in this shell: it is fetched the first time it is asked
 * for and never before, so the cost falls only on the reader who wants it.
 */

let docsMounted = false

/** Load, announce the wait honestly, and hand back a ready interpreter. */
async function boot(ctx: Ctx): Promise<PyodideApi | null> {
  if (!isReady()) {
    ctx.note(`loading python ${pythonVersion()} — a few megabytes, once`)
  }
  const started = performance.now()
  let py: PyodideApi
  try {
    py = await loadPython()
  } catch (err) {
    ctx.error(`python: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
  if (!docsMounted) {
    mountDocs(py, [...ctx.content.posts, ...ctx.content.pages], await ctx.text())
    await prepare(py, ctx.files.root)
    docsMounted = true
    ctx.note(`ready in ${((performance.now() - started) / 1000).toFixed(1)}s · ` +
      `posts are readable at /posts, your files at ${ctx.files.root}`)
  }
  return py
}

/** Run code and render the result into the transcript. */
export async function runPython(ctx: Ctx, py: PyodideApi, code: string): Promise<void> {
  const result = await execute(py, ctx.files, code)
  for (const line of result.lines) ctx.print(line)
  if (result.error) ctx.error(result.error)
  if (result.changed.length) ctx.note(`wrote ${result.changed.join(', ')}`)
  if (result.removed.length) ctx.note(`removed ${result.removed.join(', ')}`)
  // A file the run produced that would not fit is lost when the tab closes.
  // Saying nothing would be the worst of both worlds.
  for (const problem of result.failed) ctx.error(problem)
}

const python = defineCommand({
  name: 'python',
  aliases: ['py', 'python3'],
  description: 'run Python, or open a Python prompt',
  usage: "python [file] [-c '<code>']",
  valued: ['c'],
  details: [
    'python                open a Python prompt (Ctrl+D or exit() to leave)',
    "python -c 'print(1)'  run one line and print it here",
    'python script.py      run a file from your home directory',
    '',
    'The interpreter is Pyodide, fetched from a CDN the first time you ask',
    'for it and cached by your browser after that. Posts are readable at',
    '/posts; anything the script writes under your home directory comes back',
    'to the shell. There is no stdin, so input() will fail.',
  ].join('\n'),
  complete: (ctx) => ctx.files.list().filter((e) => e.kind === 'file' && e.name.endsWith('.py')).map((e) => `~/${e.name}`),
  async run(ctx, line) {
    const code = typeof line.flags.c === 'string' ? line.flags.c : null
    const file = line.args[0]

    if (!code && !file) {
      if (ctx.piped) { ctx.error('python: the prompt needs a screen — use -c in a pipe'); return }
      const py = await boot(ctx)
      if (py) ctx.repl(py)
      return
    }

    // Read the file before booting: fetching megabytes of interpreter only to
    // report a typo is a poor trade.
    let source = code
    if (!source) {
      const { store, path } = ctx.resolve(file!)
      const text = store ? ctx.files.read(path) : null
      if (text === null) { ctx.error(`python: ${file}: no such file in ${ctx.files.root}`); return }
      source = text
    }

    const py = await boot(ctx)
    if (!py) return
    return runPython(ctx, py, source)
  },
})

const pip = defineCommand({
  name: 'pip',
  description: 'install a Python package',
  usage: 'pip install <package>  ·  pip list',
  details: [
    'Uses micropip, so it can install pure-Python wheels from PyPI and any',
    'package Pyodide builds itself. Anything with compiled C that Pyodide',
    'has not built will refuse, and say so.',
    '',
    'Installs last for the session, not across reloads.',
  ].join('\n'),
  async run(ctx, line) {
    const [action, ...rest] = line.args
    if (action !== 'install' && action !== 'list') {
      ctx.error('pip: try `pip install <package>` or `pip list`')
      return
    }
    if (action === 'install' && !rest.length) {
      // Cheap check first: fetching an interpreter to report a typo is a poor
      // trade, the same one `python <file>` already refuses to make.
      ctx.error('pip install: which package?')
      return
    }

    const py = await boot(ctx)
    if (!py) return

    if (action === 'list') {
      return runPython(ctx, py,
        'import importlib.metadata as m\n' +
        'for d in sorted(m.distributions(), key=lambda d: d.metadata["Name"] or ""):\n' +
        '    print(f\'{d.metadata["Name"]:<28} {d.version}\')\n')
    }

    ctx.note(`installing ${rest.join(', ')}…`)
    const names = JSON.stringify(rest)
    await runPython(ctx, py,
      'import micropip\n' +
      `for name in ${names}:\n` +
      '    await micropip.install(name)\n' +
      `    print(f'installed {name}')\n`)
  },
})

export const pythonCommands: Command[] = [python, pip]

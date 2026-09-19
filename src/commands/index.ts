import { Registry, type Command } from '../core/registry.js'
import { builtins } from './builtin.js'
import { filters } from './filters.js'
import { shellish } from './shellish.js'
import { fileCommands } from './files.js'
import { pythonCommands } from './python.js'

/**
 * Author commands. Any module in src/commands/user/ whose default export is a
 * Command is registered at build time — no manifest to edit, and `help` and
 * `man` pick it up because they read the registry.
 */
const userModules = import.meta.glob<{ default: Command }>('./user/*.ts', { eager: true })

export function createRegistry(): Registry {
  const registry = new Registry()
  for (const cmd of [...builtins, ...filters, ...shellish, ...fileCommands, ...pythonCommands]) registry.add(cmd)
  for (const [path, mod] of Object.entries(userModules)) {
    const cmd = mod?.default
    if (cmd && typeof cmd.run === 'function' && cmd.name) registry.add(cmd)
    else console.warn(`[proseos] ${path} has no valid default-exported command`)
  }
  return registry
}

export { builtins }

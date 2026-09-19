import site from '../../site.config.js'

export interface Settings {
  theme: string
  mediaMode: 'hybrid' | 'real' | 'ascii'
  mediaColors: 16 | 256 | 'true'
  mediaColumns: number
  ligatures: boolean
}

const KEY = 'proseos:settings'

const defaults = (): Settings => ({
  theme: site.defaultTheme,
  mediaMode: site.media.mode,
  mediaColors: site.media.colors,
  mediaColumns: site.media.columns,
  ligatures: site.ligatures,
})

/**
 * localStorage can throw (private mode, blocked site data) and can come back
 * empty. Every read and write is guarded; the site must work without it.
 *
 * `stored` reports whether the reader has ever chosen: the OS dark-mode
 * preference may only override a default, never an explicit choice.
 */
export function load(): { settings: Settings; stored: boolean } {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { settings: base, stored: false }
    return { settings: { ...base, ...(JSON.parse(raw) as Partial<Settings>) }, stored: true }
  } catch {
    return { settings: base, stored: false }
  }
}

export function save(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* readers in private mode simply do not get persistence */
  }
}

export function reset(): Settings {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  return defaults()
}

const ALIAS_KEY = 'proseos:aliases'

/** Aliases live beside the settings but in their own key, so one can be
 *  cleared without losing the other. */
export function loadAliases(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALIAS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function saveAliases(aliases: Record<string, string>): void {
  try { localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases)) } catch { /* ignore */ }
}

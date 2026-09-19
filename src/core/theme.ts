export interface Theme {
  name: string
  label: string
  scheme: 'light' | 'dark'
  bg: string
  surface: string
  fg: string
  dim: string
  accent: string
  border: string
  /** ANSI 0-15. Media quantized to 16 colours maps into exactly these. */
  ansi: readonly string[]
}

export const themes: Record<string, Theme> = {
  anthropic: {
    name: 'anthropic',
    label: 'Anthropic (light)',
    scheme: 'light',
    bg: '#FAF9F5', surface: '#F0EEE6', fg: '#262625',
    dim: '#6B6A64', accent: '#D97757', border: '#DDD9CE',
    ansi: [
      '#3D3D3A', '#B0453A', '#5F7A4A', '#A8763E', '#4E7A9B', '#7D6490', '#4C8079', '#D8D3C6',
      '#8A8880', '#D97757', '#7E9C63', '#C99A4E', '#6E9CC0', '#A08CB4', '#6BA49C', '#FAF9F5',
    ],
  },
  'anthropic-dark': {
    name: 'anthropic-dark',
    label: 'Anthropic (dark)',
    scheme: 'dark',
    bg: '#191919', surface: '#262625', fg: '#F0EEE6',
    dim: '#8A8880', accent: '#D97757', border: '#3A3A38',
    ansi: [
      '#262625', '#C25D52', '#7E9C63', '#C99A4E', '#6E9CC0', '#A08CB4', '#6BA49C', '#C9C4B8',
      '#55544F', '#E08D6E', '#96B47A', '#DDB169', '#8AB3D4', '#B9A6CB', '#85BCB4', '#FAF9F5',
    ],
  },
  nord: {
    name: 'nord',
    label: 'Nord',
    scheme: 'dark',
    bg: '#2E3440', surface: '#3B4252', fg: '#D8DEE9',
    dim: '#7B88A1', accent: '#88C0D0', border: '#434C5E',
    ansi: [
      '#3B4252', '#BF616A', '#A3BE8C', '#EBCB8B', '#81A1C1', '#B48EAD', '#88C0D0', '#E5E9F0',
      '#4C566A', '#D08770', '#A3BE8C', '#EBCB8B', '#81A1C1', '#B48EAD', '#8FBCBB', '#ECEFF4',
    ],
  },
  gruvbox: {
    name: 'gruvbox',
    label: 'Gruvbox (dark)',
    scheme: 'dark',
    bg: '#282828', surface: '#32302F', fg: '#EBDBB2',
    dim: '#928374', accent: '#FE8019', border: '#3C3836',
    ansi: [
      '#282828', '#CC241D', '#98971A', '#D79921', '#458588', '#B16286', '#689D6A', '#A89984',
      '#928374', '#FB4934', '#B8BB26', '#FABD2F', '#83A598', '#D3869B', '#8EC07C', '#EBDBB2',
    ],
  },
  paper: {
    name: 'paper',
    label: 'Paper (high contrast)',
    scheme: 'light',
    bg: '#FFFFFF', surface: '#F4F4F4', fg: '#111111',
    dim: '#5A5A5A', accent: '#0B57D0', border: '#D6D6D6',
    ansi: [
      '#111111', '#A00000', '#006400', '#8A6100', '#0B57D0', '#7A0E7A', '#00686B', '#CFCFCF',
      '#5A5A5A', '#D01818', '#0A7D0A', '#B58200', '#2F7BE8', '#A020A0', '#009598', '#FFFFFF',
    ],
  },
}

export const themeNames = Object.keys(themes)

export function apply(name: string): Theme {
  // `themes` is an object literal, so `themes['constructor']` is a function,
  // not undefined — `??` would happily accept it.
  const theme = Object.hasOwn(themes, name) ? themes[name] : themes.anthropic
  const root = document.documentElement
  root.style.setProperty('--bg', theme.bg)
  root.style.setProperty('--surface', theme.surface)
  root.style.setProperty('--fg', theme.fg)
  root.style.setProperty('--dim', theme.dim)
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--border', theme.border)
  theme.ansi.forEach((c, i) => root.style.setProperty(`--ansi-${i}`, c))
  root.dataset.theme = theme.name
  root.style.colorScheme = theme.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg)
  return theme
}

/** Used before any stored preference exists. */
export function preferred(fallback: string): string {
  try {
    if (Object.hasOwn(themes, fallback) && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      const dark = fallback === 'anthropic' ? 'anthropic-dark' : fallback
      return Object.hasOwn(themes, dark) ? dark : fallback
    }
  } catch { /* matchMedia missing */ }
  return fallback
}

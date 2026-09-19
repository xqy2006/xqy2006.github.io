import type { Settings } from '../core/settings.js'
import type { Theme } from '../core/theme.js'

/** Upper half block: foreground paints the top pixel, background the bottom. */
const HALF = '▀'

/** 4x4 ordered (Bayer) threshold map, normalised to -0.5..+0.5. */
const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
].map((r) => r.map((v) => v / 16 - 0.5))

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Perceptually weighted distance (redmean); cheap enough for tens of
 * thousands of lookups. Returns the index and how far off it was.
 */
function nearest(palette: [number, number, number][], r: number, g: number, b: number): [number, number] {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i]
    const rm = (pr + r) / 2
    const dr = pr - r, dg = pg - g, db = pb - b
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db
    if (d < bestD) { bestD = d; best = i }
  }
  return [best, bestD]
}

/**
 * Below this redmean distance a pixel is treated as an exact palette hit and
 * left undithered. Without it, ordered dithering shreds flat regions: pure
 * white becomes a checkerboard of slots 7 and 15, which wrecks screenshots
 * and any image with a plain background.
 */
const EXACT = 1200

/** The xterm 6x6x6 cube plus the 24-step grey ramp, offset by the 16 base slots. */
function xterm256(base: [number, number, number][]): [number, number, number][] {
  const out = base.slice(0, 16)
  const steps = [0, 95, 135, 175, 215, 255]
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    out.push([steps[r], steps[g], steps[b]])
  }
  for (let i = 0; i < 24; i++) { const v = 8 + i * 10; out.push([v, v, v]) }
  return out
}

export interface CellArt {
  cols: number
  rows: number
  /** Top and bottom palette index (or packed rgb) per cell, row-major. */
  top: Int32Array
  bottom: Int32Array
  mode: 16 | 256 | 'true'
}

/**
 * Cell height / cell width, measured with a real `.art` cell so the probe sees
 * that stylesheet's line-height. Measuring in the surrounding figure instead
 * reports a cell two thirds too tall and the art comes out squashed.
 */
function artCellAspect(layer: HTMLElement): number {
  const probe = document.createElement('pre')
  probe.className = 'art'
  probe.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;margin:0'
  // Raw text, not a cell: cells carry overlap padding that would skew the ratio.
  probe.textContent = 'M'
  layer.appendChild(probe)
  const r = probe.getBoundingClientRect()
  probe.remove()
  return r.width > 0 && r.height > 0 ? r.height / r.width : 2
}

/**
 * Scale the art so its content spans the figure exactly.
 *
 * Two passes, because neither alone is enough. Font-size gets the text
 * rasterized at its natural size, but each cell is `1ch` and the browser
 * rounds inline-block widths to whole pixels, so the total lands within a few
 * percent and never exactly. A residual transform then closes that gap
 * without re-rasterizing at a silly size. Both passes measure what was laid
 * out rather than predicting from font metrics, which is wrong whenever the
 * figure is measured before layout settles or before the webfont swaps in —
 * and the art is then silently clipped by the figure's overflow.
 */
function fitArt(fig: HTMLElement, layer: HTMLElement): void {
  const pre = layer.querySelector<HTMLElement>('.art')
  const target = fig.clientWidth
  if (!pre || !target) return

  pre.style.transform = 'none'
  let box = pre.getBoundingClientRect()
  if (!box.width || !box.height) return

  const current = parseFloat(getComputedStyle(pre).fontSize) || 16
  const scaled = (current * target) / box.width
  if (Number.isFinite(scaled) && scaled >= 1 && Math.abs(scaled - current) > 0.05) {
    pre.style.fontSize = `${scaled}px`
    box = pre.getBoundingClientRect()
  }
  if (!box.width || !box.height) return

  const residual = target / box.width
  if (Number.isFinite(residual) && Math.abs(residual - 1) > 0.002) {
    pre.style.transformOrigin = '0 0'
    pre.style.transform = `scale(${residual})`
  }
  // A transform does not affect layout, so the wrapper has to carry the height.
  layer.style.height = `${box.height * residual}px`
}

export interface Pixels { data: Uint8ClampedArray; w: number; h: number }

/**
 * Sample an image down to one pixel per half-cell.
 * Returns null when the canvas is tainted by a cross-origin source.
 */
export function sample(img: HTMLImageElement, cols: number, aspect: number): Pixels | null {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return null
  const w = Math.max(1, Math.min(cols, 200))
  // Each cell holds two vertical pixels, so a cell of aspect `aspect`
  // makes each sampled pixel aspect/2 tall in cell units.
  const h = Math.max(2, Math.round((w * ih / iw) * (2 / aspect)) * 1)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h % 2 === 0 ? h : h + 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { data: d.data, w: canvas.width, h: canvas.height }
  } catch {
    return null // tainted canvas: hotlinked image without CORS headers
  }
}

/** Quantize sampled pixels into per-cell indices, with ordered dithering. */
export function quantize(px: Pixels, theme: Theme, mode: 16 | 256 | 'true'): CellArt {
  const cols = px.w
  const rows = px.h / 2
  const top = new Int32Array(cols * rows)
  const bottom = new Int32Array(cols * rows)
  const base = theme.ansi.map(hexToRgb)
  const palette = mode === 16 ? base : mode === 256 ? xterm256(base) : null
  const spread = mode === 16 ? 56 : 24

  const at = (x: number, y: number): number => {
    const i = (y * px.w + x) * 4
    let r = px.data[i], g = px.data[i + 1], b = px.data[i + 2]
    const a = px.data[i + 3] / 255
    if (a < 1) {
      const [br, bg, bb] = hexToRgb(theme.bg)
      r = r * a + br * (1 - a); g = g * a + bg * (1 - a); b = b * a + bb * (1 - a)
    }
    if (!palette) return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)
    const [flat, err] = nearest(palette, r, g, b)
    if (err < EXACT) return flat
    const t = BAYER[y & 3][x & 3] * spread
    return nearest(palette, r + t, g + t, b + t)[0]
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      top[y * cols + x] = at(x, y * 2)
      bottom[y * cols + x] = at(x, y * 2 + 1)
    }
  }
  return { cols, rows, top, bottom, mode }
}

const rgbCss = (v: number) => `#${(v & 0xffffff).toString(16).padStart(6, '0')}`

/**
 * Indexed cells reference `--ansi-N` rather than a literal colour, so switching
 * theme recolours the art with no re-render. Truecolor cells cannot do that.
 *
 * Runs of identical cells collapse into a single element. A flat background
 * costs one node per row instead of one per cell, which cuts the node count by
 * an order of magnitude and removes the hairline seams that appear between
 * abutting background boxes at fractional pixel positions.
 */
export function toHtml(art: CellArt): string {
  const out: string[] = []
  for (let y = 0; y < art.rows; y++) {
    let line = ''
    let runTop = -1
    let runBottom = -1
    let runLength = 0

    const flush = () => {
      if (!runLength) return
      const glyphs = HALF.repeat(runLength)
      line += art.mode === 'true'
        ? `<i style="color:${rgbCss(runTop)};background:${rgbCss(runBottom)}">${glyphs}</i>`
        : `<i class="f${runTop} b${runBottom}">${glyphs}</i>`
      runLength = 0
    }

    for (let x = 0; x < art.cols; x++) {
      const t = art.top[y * art.cols + x]
      const b = art.bottom[y * art.cols + x]
      if (runLength && t === runTop && b === runBottom) { runLength++; continue }
      flush()
      runTop = t
      runBottom = b
      runLength = 1
    }
    flush()
    out.push(line)
  }
  const cls = art.mode === 'true' ? 'art art-true' : 'art art-indexed'
  return `<pre class="${cls}" aria-hidden="true">${out.join('\n')}</pre>`
}

export interface MediaHost {
  settings: Settings
  theme: Theme
  onArt?: (fig: HTMLElement) => void
}

const cache = new WeakMap<HTMLElement, Pixels>()

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      // Retry without CORS so the real image still displays; art will be skipped.
      const plainImg = new Image()
      plainImg.onload = () => resolve(plainImg)
      plainImg.onerror = reject
      plainImg.src = src
    }
    img.src = src
  })
}

/** Draw (or redraw) the art layer for one figure. */
export async function drawFigure(fig: HTMLElement, host: MediaHost): Promise<boolean> {
  const src = fig.dataset.src
  if (!src || fig.dataset.kind !== 'image') return false
  const cols = Math.max(16, Math.min(host.settings.mediaColumns, 200))

  // The layer must exist before measuring: the metrics depend on its own CSS.
  let layer = fig.querySelector<HTMLElement>('.md-art')
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'md-art'
    fig.insertBefore(layer, fig.firstChild)
  }
  let px = cache.get(fig)
  // The cache is keyed by figure, so a changed --columns must invalidate it.
  if (!px || px.w !== cols) {
    let img: HTMLImageElement
    try { img = await loadImage(src) } catch { return false }
    const sampled = sample(img, cols, artCellAspect(layer))
    if (!sampled) return false
    cache.set(fig, sampled)
    px = sampled
  }

  const art = quantize(px, host.theme, host.settings.mediaColors)
  layer.innerHTML = toHtml(art)
  fig.dataset.cols = String(art.cols)
  fig.dataset.rows = String(art.rows)

  fitArt(fig, layer)
  // Refit once layout settles and again when the webfont swaps in: both change
  // the cell width after the first pass.
  requestAnimationFrame(() => fitArt(fig, layer))
  void document.fonts?.ready.then(() => fitArt(fig, layer))
  observeResize(fig, layer)
  host.onArt?.(fig)
  return true
}

const observed = new WeakMap<HTMLElement, ResizeObserver>()
const lastWidth = new WeakMap<HTMLElement, number>()

/** Refit when the figure changes width; scaling never re-quantizes. */
function observeResize(fig: HTMLElement, layer: HTMLElement): void {
  if (observed.has(fig) || typeof ResizeObserver === 'undefined') return
  const ro = new ResizeObserver(() => {
    const w = fig.clientWidth
    if (lastWidth.get(fig) === w) return // height-only change: our own refit
    lastWidth.set(fig, w)
    fitArt(fig, layer)
  })
  ro.observe(fig)
  observed.set(fig, ro)
}

/** Re-quantize every already-drawn figure. Cheap: pixels are cached. */
export function recolorAll(scope: ParentNode, host: MediaHost): void {
  scope.querySelectorAll<HTMLElement>('.md-media[data-kind="image"]').forEach((fig) => {
    if (cache.has(fig)) void drawFigure(fig, host)
  })
}

/**
 * Apply the current media mode to every figure in `scope`.
 * hybrid: art paints first, then the real image fades in over it.
 * ascii:  art only, with a link to the original.
 * real:   no art at all.
 */
export function upgradeMedia(scope: ParentNode, host: MediaHost): void {
  const figs = scope.querySelectorAll<HTMLElement>('.md-media')
  figs.forEach((fig) => {
    const kind = fig.dataset.kind
    fig.dataset.mode = host.settings.mediaMode
    if (kind !== 'image') return

    if (host.settings.mediaMode === 'real') {
      fig.querySelector('.md-art')?.remove()
      fig.classList.remove('is-art', 'is-resolved')
      return
    }

    fig.classList.add('is-art')
    fig.classList.remove('is-resolved')
    void drawFigure(fig, host).then((ok) => {
      if (!ok) {
        // Tainted or unreachable: fall back to the framed real image.
        fig.classList.remove('is-art')
        fig.dataset.mode = 'real'
        return
      }
      if (host.settings.mediaMode === 'hybrid') {
        requestAnimationFrame(() => fig.classList.add('is-resolved'))
      }
    })
  })
}

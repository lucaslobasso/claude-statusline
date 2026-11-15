#!/usr/bin/env node
// claude-statusline: a Claude Code status line with a fixed layout and no config file.
// Claude Code runs this as its `statusLine` command and pipes the status JSON on stdin;
// one line goes to stdout.
//
//   model + effort | context | git branch            weekly % + reset | session % + reset
//
// The two usage segments only appear once that window passes 50%. The percentage changes
// colour as it fills (white from 50%, yellow from 65%, orange from 75%, red from 90%); the
// reset time next to it stays in the terminal's default colour. Edit the constants below to
// change the look.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---- look: edit here ------------------------------------------------------
const WHITE = [238, 238, 236]
const BLUE = [114, 159, 207]
const SEPARATOR = [85, 87, 83]

// Usage colours, highest step first. A window below the lowest `from` is hidden.
const STEPS = [
  { from: 90, rgb: [239, 41, 41] }, // red
  { from: 75, rgb: [245, 160, 60] }, // orange
  { from: 65, rgb: [252, 233, 79] }, // yellow
  { from: 50, rgb: WHITE },
]

// Left group, then the right group. `color` undefined = terminal default.
const LEFT = [
  { id: 'model', color: WHITE },
  { id: 'effort' },
  { id: 'sep' },
  { id: 'context', color: BLUE },
  { id: 'sep' },
  { id: 'branch' },
]
const RIGHT = [
  { id: 'weekly', usage: 'seven_day' },
  { id: 'weeklyReset', usage: 'seven_day' },
  { id: 'sep' },
  { id: 'session', usage: 'five_hour' },
  { id: 'sessionReset', usage: 'five_hour' },
]
// ---------------------------------------------------------------------------

const ESC = '\x1b['
const paint = (text, rgb, bold) => {
  if (!rgb) return text
  const on = `${bold ? `${ESC}1m` : ''}${ESC}38;2;${rgb.join(';')}m`
  return `${on}${text}${ESC}39m${bold ? `${ESC}22m` : ''}`
}
const pad = text => `${ESC}0m ${ESC}0m${text}${ESC}0m ${ESC}0m`
const visibleLength = s => [...s.replace(/\x1b\[[0-9;]*m/g, '')].length

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()

const pct = n => `${Math.min(100, Math.max(0, n)).toFixed(1)}%`

const countdown = epochSeconds => {
  const left = Math.max(0, epochSeconds * 1000 - Date.now())
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left % 86_400_000) / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  return [d > 0 && `${d}d`, h > 0 && `${h}hr`, m > 0 && `${m}m`].filter(Boolean).join(' ') || '0m'
}

// The step a usage percentage falls in, or undefined when it is below the lowest one.
export const stepFor = percent => STEPS.find(s => percent >= s.from)

const configDir = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')

// Effort shown as arrows. An unknown level shows as text with a "?", no level at all hides it.
const EFFORT_ARROWS = { low: '↓', medium: '–', high: '↑', xhigh: '↑↑', max: '↑↑↑' }

const effortOf = input => {
  let level = typeof input.effort?.level === 'string' ? input.effort.level.toLowerCase() : undefined
  if (!level && typeof input.transcript_path === 'string') {
    try {
      const lines = readFileSync(input.transcript_path, 'utf8').split('\n')
      for (let i = lines.length - 1; i >= 0 && !level; i--) {
        const hit =
          /Set effort level to ([a-z0-9-]+)/i.exec(lines[i]) ?? /Set model to .*? with ([a-z0-9-]+) effort/i.exec(lines[i])
        if (hit) level = hit[1].toLowerCase()
      }
    } catch {}
  }
  if (!level) {
    try {
      const saved = JSON.parse(readFileSync(join(configDir(), 'settings.json'), 'utf8')).effortLevel
      if (typeof saved === 'string') level = saved.toLowerCase()
    } catch {}
  }
  if (!level || level === 'default') return undefined
  return EFFORT_ARROWS[level] ?? (/^[a-z0-9-]{2,20}$/.test(level) ? `${level}?` : undefined)
}

const contextOf = input => {
  const w = input.context_window
  if (typeof w?.used_percentage === 'number') return pct(w.used_percentage)
  const u = w?.current_usage
  if (u && w?.context_window_size > 0) {
    const used = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
    return pct((used / w.context_window_size) * 100)
  }
}

const branchOf = input => {
  const cwd = input.cwd || input.workspace?.current_dir || input.workspace?.project_dir || process.cwd()
  try {
    if (git(['rev-parse', '--is-inside-work-tree'], cwd) !== 'true') return undefined
  } catch {
    return undefined // not a repo: the segment and its separator disappear
  }
  try {
    return git(['symbolic-ref', 'HEAD'], cwd).replace(/^refs\/heads\//, '')
  } catch {
    try {
      return `(${git(['rev-parse', '--short', 'HEAD'], cwd)})`
    } catch {
      return undefined
    }
  }
}

// ---- usage snapshot ---------------------------------------------------------
// Every session reports its own last rate-limit reading, so an idle one is stale. Readings are
// merged into one file: the newest window wins, then the highest % within a window. A session
// that has no reading yet (fresh start) shows the snapshot instead of nothing.
const SNAPSHOT_DIR = () => join(configDir(), 'statusline')
const SAME_WINDOW_S = 600 // reset times within 10 min of each other are the same window

const validWindow = w => w && typeof w.used_percentage === 'number' && typeof w.resets_at === 'number'

export const pickWindow = (old, neu, now) => {
  if (!validWindow(neu) || neu.resets_at <= now) return validWindow(old) && old.resets_at > now ? old : null
  if (!validWindow(old) || old.resets_at <= now) return neu
  if (neu.resets_at - old.resets_at > SAME_WINDOW_S) return neu // a newer window started
  if (old.resets_at - neu.resets_at > SAME_WINDOW_S) return old // neu is from an older window
  return neu.used_percentage >= old.used_percentage ? neu : old
}

const readSnapshot = () => {
  try {
    return JSON.parse(readFileSync(join(SNAPSHOT_DIR(), 'usage.json'), 'utf8'))
  } catch {
    return {}
  }
}

// The rate-limit windows to show: this session's own reading, else the snapshot's.
const limitsOf = (input, snapshot) => {
  const now = Date.now() / 1000
  const own = input.rate_limits ?? {}
  const pick = kind => (validWindow(own[kind]) && own[kind].resets_at > now ? own[kind] : pickWindow(snapshot[kind], null, now))
  return { five_hour: pick('five_hour'), seven_day: pick('seven_day') }
}

const saveSnapshot = (input, snapshot) => {
  const limits = input.rate_limits
  if (!limits?.five_hour && !limits?.seven_day) return
  try {
    const now = Date.now() / 1000
    const five_hour = pickWindow(snapshot.five_hour, limits.five_hour, now)
    const seven_day = pickWindow(snapshot.seven_day, limits.seven_day, now)
    if (
      JSON.stringify(five_hour) === JSON.stringify(snapshot.five_hour ?? null) &&
      JSON.stringify(seven_day) === JSON.stringify(snapshot.seven_day ?? null)
    )
      return
    const dir = SNAPSHOT_DIR()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const file = join(dir, 'usage.json')
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify({ five_hour, seven_day, writtenAt: Date.now() }))
    renameSync(tmp, file)
  } catch {}
}
// ---------------------------------------------------------------------------

// A widget's text and colour. Usage widgets return nothing below the lowest step, so the
// widget (and any separator that only joined it) disappears.
const widget = (w, input, limits) => {
  switch (w.id) {
    case 'model': {
      const m = input.model
      const name = typeof m === 'string' ? m : (m?.display_name ?? m?.id)
      return { text: name ? name.replace(/\s*\(.*\)$/, '') : undefined, rgb: w.color }
    }
    case 'effort':
      return { text: effortOf(input) }
    case 'context':
      return { text: contextOf(input), rgb: w.color }
    case 'branch':
      return { text: branchOf(input) }
    case 'weekly':
    case 'session': {
      const win = limits[w.usage]
      const step = win && stepFor(win.used_percentage)
      return step ? { text: pct(win.used_percentage), rgb: step.rgb, bold: step.bold } : {}
    }
    case 'weeklyReset':
    case 'sessionReset': {
      const win = limits[w.usage]
      const step = win && stepFor(win.used_percentage)
      return step ? { text: countdown(win.resets_at) } : {} // default colour
    }
  }
  return {}
}

// One group of widgets: widgets with nothing to show vanish, and a separator needs content
// before it and after it.
const render = (spec, input, limits) => {
  const parts = []
  for (const w of spec) {
    if (w.id === 'sep') {
      if (parts.length && parts[parts.length - 1].sep === false) parts.push({ sep: true, text: paint(' | ', SEPARATOR) })
      continue
    }
    const { text, rgb, bold } = widget(w, input, limits)
    if (text) parts.push({ sep: false, text: pad(paint(text, rgb, bold)) })
  }
  while (parts.length && parts[parts.length - 1].sep) parts.pop()
  return parts.map(p => p.text).join('')
}

// Cut to `max` visible cells, keeping the colour codes before the cut, marking it "...".
const truncate = (line, max) => {
  let out = ''
  let seen = 0
  for (const [, code, ch] of line.matchAll(/(\x1b\[[0-9;]*m)|([\s\S])/gu)) {
    if (code) out += code
    else if (seen < max - 3) {
      out += ch
      seen++
    } else break
  }
  return `${out}...`
}

export const main = (input, snapshot = {}) => {
  const limits = limitsOf(input, snapshot)
  // No padding space at the outer edges of the line, only between widgets.
  const trimStart = s => s.replace(/^\x1b\[0m /, `${ESC}0m`)
  const trimEnd = s => s.replace(/ \x1b\[0m$/, `${ESC}0m`)
  let left = trimStart(render(LEFT, input, limits))
  let right = trimEnd(render(RIGHT, input, limits))
  if (!right) left = trimEnd(left)
  if (!left) right = trimStart(right)
  const width = Number(process.env.CCSTATUSLINE_WIDTH || process.env.COLUMNS) || 0
  let line
  if (!right) {
    line = left
  } else if (!left) {
    line = right
  } else if (width > 0) {
    const usable = width - 5
    const gap = Math.max(0, usable - visibleLength(left) - visibleLength(right))
    line = left + ' '.repeat(gap) + right
    if (visibleLength(line) > usable) line = truncate(line, usable)
  } else {
    // Terminal width unknown (always so on Windows): a gray bar between the groups.
    line = left + `${ESC}90m | ${ESC}39m` + right
  }
  // Non-breaking spaces so the terminal keeps the padding.
  return `${ESC}0m${line}`.replace(/ /g, ' ')
}

// Run as the status line (not when imported by the tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => (raw += c))
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}')
      const snapshot = readSnapshot()
      saveSnapshot(input, snapshot)
      process.stdout.write(main(input, snapshot) + '\n')
    } catch {}
  })
}

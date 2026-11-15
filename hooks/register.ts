import type { EngineInterface, Register } from 'claude-code'

// Claude Code takes `statusLine` only from the settings files, not from a plugin, so the plugin
// keeps that entry in the user settings.json in step with its settings: on adds it (or refreshes
// our own, whose path changes with each plugin version), off removes it. An entry that is not
// ours is never touched; the person is told instead.
//
// "Ours" is narrow on purpose (a too-broad match once deleted other people's status lines):
//   - a command running a statusline.mjs inside a `claude-statusline` folder (this plugin), or
//   - the legacy install.ps1 copy: <config dir>/statusline/statusline.mjs, or
//   - boxed-messages 1.x's built-in status line, which now points at a deleted plugin folder.

const PLUGIN = 'statusline'
const COMMAND = 'claude-statusline'
const BLOCK = /[ \t]*"statusLine"\s*:\s*\{[^{}]*\}[ \t]*,?[ \t]*\r?\n?/

export type Options = Record<string, unknown>
type Settings = Record<string, any>

const slash = (p: string) => p.replace(/\\/g, '/')

/** Flags for statusline.mjs: only the settings that differ from its defaults. */
export const flagsFor = (options: Options): string[] => {
  const flags: string[] = []
  const num = (key: string, flag: string, def: number) => {
    const n = Number(options[key])
    if (options[key] !== undefined && options[key] !== '' && Number.isFinite(n) && n !== def) flags.push(`--${flag}=${n}`)
  }
  num('usageFrom', 'usage-from', 50)
  num('yellowFrom', 'yellow-from', 65)
  num('orangeFrom', 'orange-from', 75)
  num('redFrom', 'red-from', 90)
  const toggles = { showEffort: 'effort', showContext: 'context', showBranch: 'branch', showResets: 'resets' }
  for (const [key, flag] of Object.entries(toggles)) {
    if (options[key] === false) flags.push(`--no-${flag}`)
  }
  return flags
}

export const isOurs = (command: unknown, configDir: string): boolean => {
  if (typeof command !== 'string' || !/statusline\.mjs/.test(command)) return false
  const c = slash(command).toLowerCase()
  if (/claude-statusline[^"]*\/statusline\.mjs/.test(c)) return true
  if (c.includes(`${slash(configDir).toLowerCase()}/statusline/statusline.mjs`)) return true
  return /boxed-messages[^"]*\/statusline\/statusline\.mjs/.test(c)
}

const configDirOf = async ($: EngineInterface) => {
  const dir = await $.env.get('CLAUDE_CONFIG_DIR')
  if (dir) return slash(dir)
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home ? `${slash(home)}/.claude` : undefined
}

/** The wanted settings text, keeping the file's own formatting when a small edit gets there. */
export const nextSettings = (text: string, settings: Settings, wanted: object | undefined): string => {
  const want: Settings = { ...settings }
  if (wanted) want.statusLine = wanted
  else delete want.statusLine
  const entry = wanted ? `"statusLine": ${JSON.stringify(wanted)}` : ''
  let next: string
  if (settings.statusLine !== undefined) {
    next = wanted ? text.replace(BLOCK, m => m.replace(/"statusLine"[\s\S]*\}/, entry)) : text.replace(BLOCK, '')
  } else {
    const more = Object.keys(settings).length > 0
    next = text.replace('{', `{\n  ${entry}${more ? ',' : '\n'}`)
  }
  try {
    if (JSON.stringify(JSON.parse(next)) === JSON.stringify(want)) return next
  } catch {}
  return JSON.stringify(want, null, 2) + '\n'
}

/** Brings settings.json in line: 'set' adds/refreshes our entry, 'remove' drops it. Returns a notice. */
export const sync = async ($: EngineInterface, action: 'set' | 'remove', options: Options): Promise<string | undefined> => {
  const dir = await configDirOf($)
  if (!dir) return undefined
  const file = `${dir}/settings.json`
  let text: string
  let settings: Settings
  try {
    text = (await $.fs.read(file)) as string
    settings = JSON.parse(text)
  } catch {
    text = '{}\n'
    settings = {}
  }
  const current = settings.statusLine
  const ours = current === undefined || isOurs(current?.command, dir)
  if (!ours) {
    return action === 'set'
      ? `${COMMAND}: settings.json already has another status line (${String(current?.command ?? current?.type)}). Remove it, then run /${COMMAND} on.`
      : undefined
  }
  let wanted: object | undefined
  if (action === 'set') {
    const script = `${slash($.plugin.root)}/statusline.mjs`
    const command = ['node', `"${script}"`, ...flagsFor(options)].join(' ')
    wanted = { type: 'command', command, padding: 0, refreshInterval: 10 }
    if (JSON.stringify(current) === JSON.stringify(wanted)) return undefined
  } else if (current === undefined) {
    return undefined
  }
  await $.fs.write(file, nextSettings(text, settings, wanted))
  return undefined
}

const USAGE = `Usage: /${COMMAND} on | off | status   (looks and thresholds are in /config)`

export const register: Register = (on, options) => {
  const enabled = options.enabled !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Status line: on | off | status',
      argumentHint: '[on|off|status]',
      immediate: true,
    })
    try {
      const notice = await sync($, enabled ? 'set' : 'remove', options)
      if (notice) $.ui.toast(notice)
    } catch {}
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = (typeof e.args === 'string' ? e.args : '').trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const isOn = arg === 'on'
      const { deny } = await $.config.set({ key: `${PLUGIN}.enabled`, value: isOn })
      if (deny) return { text: `Couldn't change it: ${deny}` }
      const notice = await sync($, isOn ? 'set' : 'remove', options)
      return { text: notice ?? (isOn ? 'Status line on.' : 'Status line off: removed from settings.json.') }
    }
    if (arg !== '' && arg !== 'status' && arg !== 'help') return { text: `Unknown option "${arg}".\n${USAGE}` }
    const flags = flagsFor(options)
    return {
      text: `Status line: ${enabled ? 'on' : 'off'}${flags.length ? ` · ${flags.join(' ')}` : ' · default look'}\n${USAGE}`,
    }
  }).catch(() => ({ text: `${COMMAND}: the command failed; see claude --debug.` }))
}

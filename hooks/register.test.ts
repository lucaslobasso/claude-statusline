import { expect, test } from 'claude-code/testing'
import { flagsFor, isOurs, nextSettings, register } from './register'

// The status line entry the plugin keeps in settings.json, with a fake engine underneath.
type Hook = ($: any, e: any, next: (e: unknown) => Promise<unknown>) => Promise<unknown>

const ROOT = 'C:\\Users\\me\\.claude\\plugins\\cache\\claude-statusline\\statusline\\2.0.0'
const OURS = 'node "C:/Users/me/.claude/plugins/cache/claude-statusline/statusline/2.0.0/statusline.mjs"'
const OLD_VERSION = 'node "C:/Users/me/.claude/plugins/cache/claude-statusline/statusline/1.9.0/statusline.mjs"'
const LEGACY = 'node "C:/Users/me/.claude/statusline/statusline.mjs"'
const BOXED_1X = 'node "C:/Users/me/.claude/plugins/cache/claude-boxed-messages/boxed-messages/1.1.1/statusline/statusline.mjs"'
const entry = (command: string) => `{"type":"command","command":${JSON.stringify(command)},"padding":0,"refreshInterval":10}`

const run = async (file: string | undefined, options: Record<string, unknown> = {}, env: Record<string, string> = { USERPROFILE: 'C:\\Users\\me' }) => {
  let hook: Hook | undefined
  const on = (event: string, ...rest: any[]) => {
    if (event === 'session.start') hook = rest[rest.length - 1]
    return { catch: () => undefined }
  }
  ;(register as any)(on, options)
  const state = { file, path: '', writes: 0, toasts: [] as string[] }
  const $ = {
    plugin: { name: 'statusline', root: ROOT },
    command: { register: async () => ({}) },
    env: { get: async (name: string) => env[name] },
    fs: {
      read: async (path: string) => {
        state.path = path
        if (state.file === undefined) throw new Error('ENOENT')
        return state.file
      },
      write: async (_path: string, text: string) => {
        state.file = text
        state.writes++
      },
    },
    ui: { toast: (text: string) => state.toasts.push(text) },
  }
  await hook!($, { cwd: '/' }, async (e: unknown) => e)
  return state
}
const statusLine = (file: string | undefined) => JSON.parse(file ?? '{}').statusLine

test('no status line yet: ours is added, other settings and formatting kept', async () => {
  const s = await run('{\n  "model": "fable",\n  "env": { "A": "1" }\n}\n')
  expect(statusLine(s.file).command).toBe(OURS)
  expect(JSON.parse(s.file!).env).toEqual({ A: '1' })
  expect(s.file!).toContain('\n  "model": "fable",\n')
  expect(s.path).toBe('C:/Users/me/.claude/settings.json')
})

test('no settings.json at all: it is created', async () => {
  const s = await run(undefined)
  expect(statusLine(s.file).command).toBe(OURS)
})

test('already ours and current: nothing written', async () => {
  const s = await run(`{"statusLine":${entry(OURS)}}`)
  expect(s.writes).toBe(0)
})

test('ours from an older plugin version is refreshed to the new path', async () => {
  const s = await run(`{\n  "statusLine": ${entry(OLD_VERSION)},\n  "theme": "dark"\n}\n`)
  expect(statusLine(s.file).command).toBe(OURS)
  expect(JSON.parse(s.file!).theme).toBe('dark')
})

test('the legacy install.ps1 entry and the boxed-messages 1.x one are taken over', async () => {
  expect(statusLine((await run(`{"statusLine":${entry(LEGACY)}}`)).file).command).toBe(OURS)
  expect(statusLine((await run(`{"statusLine":${entry(BOXED_1X)}}`)).file).command).toBe(OURS)
})

test('someone else\'s status line is never touched; a notice says why', async () => {
  for (const theirs of ['npx -y ccstatusline@latest', 'node "C:/tools/statusline/statusline.mjs"', 'bash ~/my-statusline.sh']) {
    const s = await run(`{"statusLine":${entry(theirs)}}`)
    expect(s.writes).toBe(0)
    expect(s.toasts.length).toBe(1)
  }
})

test('enabled=false removes ours, leaves the rest', async () => {
  const s = await run(`{\n  "model": "fable",\n  "statusLine": ${entry(OURS)}\n}\n`, { enabled: false })
  expect(statusLine(s.file)).toBe(undefined)
  expect(JSON.parse(s.file!).model).toBe('fable')
})

test('enabled=false with someone else\'s status line: untouched, no notice', async () => {
  const s = await run(`{"statusLine":${entry('npx -y ccstatusline@latest')}}`, { enabled: false })
  expect(s.writes).toBe(0)
  expect(s.toasts.length).toBe(0)
})

test('settings become flags; defaults add none', async () => {
  expect(flagsFor({})).toEqual([])
  expect(flagsFor({ usageFrom: 50, orangeFrom: 75, redFrom: 90, showBranch: true })).toEqual([])
  expect(flagsFor({ usageFrom: 0, redFrom: 95, showBranch: false, showResets: false })).toEqual([
    '--usage-from=0',
    '--red-from=95',
    '--no-branch',
    '--no-resets',
  ])
  const s = await run('{}', { usageFrom: 60, showEffort: false })
  expect(statusLine(s.file).command).toBe(`${OURS} --usage-from=60 --no-effort`)
})

test('CLAUDE_CONFIG_DIR is honoured, for the file and for the legacy path', async () => {
  const env = { CLAUDE_CONFIG_DIR: 'D:\\cfg', USERPROFILE: 'C:\\Users\\me' }
  const s = await run(`{"statusLine":${entry('node "D:/cfg/statusline/statusline.mjs"')}}`, {}, env)
  expect(s.path).toBe('D:/cfg/settings.json')
  expect(statusLine(s.file).command).toBe(OURS)
  expect(isOurs(LEGACY, 'D:/cfg')).toBe(false)
})

test('a settings file the small edit cannot handle is rewritten whole, still valid', async () => {
  const text = '{"statusLine": {"type": "command", "command": "node \\"C:/Users/me/.claude/statusline/statusline.mjs\\"", "nested": {"x": 1}}}'
  const next = nextSettings(text, JSON.parse(text), { type: 'command', command: OURS })
  expect(JSON.parse(next).statusLine.command).toBe(OURS)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULTS, main, parseFlags, pickWindow, stepFor } from '../statusline.mjs'

const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/ /g, ' ')
const now = () => Date.now() / 1000
const win = (used, inSeconds) => ({ used_percentage: used, resets_at: now() + inSeconds })
const base = { model: { display_name: 'Opus 5.5' }, effort: { level: 'medium' }, context_window: { used_percentage: 12 }, cwd: '/nonexistent' }
const line = (rate_limits, snapshot) => main({ ...base, rate_limits }, snapshot)

test('usage below 50% is hidden, with its reset', () => {
  const out = strip(line({ five_hour: win(30, 3600), seven_day: win(49.9, 86400) }))
  assert.doesNotMatch(out, /30\.0%|49\.9%/)
  assert.match(out, /Opus 5\.5/)
  assert.doesNotMatch(out, /\d+hr|\dm\b/)
})

test('colour steps: yellow 50, orange 75, bold red 90', () => {
  assert.equal(stepFor(49.9), undefined)
  assert.deepEqual(stepFor(50).rgb, [252, 233, 79])
  assert.deepEqual(stepFor(74.9).rgb, [252, 233, 79])
  assert.deepEqual(stepFor(75).rgb, [245, 160, 60])
  assert.deepEqual(stepFor(90).rgb, [239, 41, 41])
  assert.equal(stepFor(90).bold, true)
  const out = line({ five_hour: win(95, 3600) })
  assert.match(out, /\x1b\[1m\x1b\[38;2;239;41;41m/)
  assert.match(strip(out), /95\.0%/)
})

test('session and weekly are coloured independently', () => {
  const out = line({ five_hour: win(80, 3600), seven_day: win(55, 86400) })
  assert.match(out, /38;2;245;160;60m[^\x1b]*80\.0%/)
  assert.match(out, /38;2;252;233;79m[^\x1b]*55\.0%/)
})

test('one visible window leaves no dangling separator', () => {
  const out = strip(line({ five_hour: win(60, 3600), seven_day: win(10, 86400) }))
  assert.match(out, /60\.0%/)
  assert.doesNotMatch(out, /\|\s*$/)
})

test('falls back to the snapshot when the session has no reading, dropping expired windows', () => {
  const snapshot = { five_hour: win(70, 1800), seven_day: { used_percentage: 99, resets_at: now() - 5 } }
  const out = strip(main({ ...base }, snapshot))
  assert.match(out, /70\.0%/)
  assert.doesNotMatch(out, /99\.0%/)
})

test('pickWindow: newest window wins, then highest percentage', () => {
  const t = now()
  const old = { used_percentage: 80, resets_at: t + 1000 }
  assert.equal(pickWindow(old, { used_percentage: 40, resets_at: t + 1100 }, t), old.used_percentage === 80 ? old : null)
  const newer = { used_percentage: 5, resets_at: t + 9000 }
  assert.equal(pickWindow(old, newer, t), newer)
  assert.equal(pickWindow(old, null, t), old)
  assert.equal(pickWindow(old, { used_percentage: 20, resets_at: t - 1 }, t), old)
})

test('no flags: the defaults', () => {
  assert.deepEqual(parseFlags([]), DEFAULTS)
})

test('flags: numbers, booleans, and junk ignored', () => {
  const o = parseFlags(['--usage-from=60', '--orange-from=80', '--red-from=95', '--no-branch', '--effort=false', '--resets', '--bogus=1', '--context=', 'x'])
  assert.equal(o.usageFrom, 60)
  assert.equal(o.orangeFrom, 80)
  assert.equal(o.redFrom, 95)
  assert.equal(o.branch, false)
  assert.equal(o.effort, false)
  assert.equal(o.resets, true)
  assert.equal(o.context, true)
  assert.equal(parseFlags(['--usage-from=abc']).usageFrom, 50)
  assert.equal(parseFlags(['--usage-from=500']).usageFrom, 100)
})

test('usageFrom moves the hidden threshold; steps follow the flags', () => {
  const o = parseFlags(['--usage-from=0'])
  assert.deepEqual(stepFor(10, o).rgb, [252, 233, 79])
  assert.match(strip(main({ ...base, rate_limits: { five_hour: win(10, 3600) } }, {}, o)), /10\.0%/)
  const late = parseFlags(['--usage-from=70', '--orange-from=85', '--red-from=95'])
  assert.equal(stepFor(60, late), undefined)
  assert.deepEqual(stepFor(86, late).rgb, [245, 160, 60])
  assert.deepEqual(stepFor(94, late).rgb, [245, 160, 60])
})

test('hiding widgets: effort, context, branch, resets', () => {
  const o = parseFlags(['--no-effort', '--no-context', '--no-resets'])
  const out = strip(main({ ...base, rate_limits: { five_hour: win(80, 3600) } }, {}, o))
  assert.doesNotMatch(out, /medium|12\.0%/)
  assert.match(out, /80\.0%/)
  assert.doesNotMatch(out, /\d+hr|\dm\b/)
})

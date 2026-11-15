#!/usr/bin/env node
// Prints the status line for made-up usage, for the README pictures:
//   node docs/demo.mjs <5-hour %> <weekly %> [statusline flags...]
// Everything else (model, effort, context, branch) is a fixed example.
import { main, parseFlags } from '../statusline.mjs'

const [five, week, ...flags] = process.argv.slice(2)
const now = Date.now() / 1000
const input = {
  model: { display_name: 'Opus 5.5' },
  effort: { level: 'high' },
  context_window: { used_percentage: 23.4 },
  cwd: process.cwd(),
  rate_limits: {
    five_hour: { used_percentage: Number(five), resets_at: now + 80 * 60 + 30 },
    seven_day: { used_percentage: Number(week), resets_at: now + (3 * 24 + 4) * 3600 + 30 },
  },
}
process.stdout.write(`\n${main(input, {}, parseFlags(flags))}\n`)

# claude-statusline

Claude Code plugin (function-hook API) that keeps a `statusLine` entry in the user's settings.json pointing at its own
`statusline.mjs`. Plugin name `statusline`, marketplace `claude-statusline` (this repo), installed id
`statusline@claude-statusline`. Command `/claude-statusline` (Claude Code has a built-in `/statusline`).

- `statusline.mjs`: the status line itself, one Node file, no dependencies. Settings arrive as flags (`parseFlags`);
  no flags must keep the original look. Tests: `node --test test/`.
- `hooks/register.ts`: writes/refreshes/removes the entry. Ownership (`isOurs`) must stay narrow: this plugin's path,
  the legacy `<config>/statusline/statusline.mjs`, or boxed-messages 1.x's. Never touch anyone else's entry.
  Tests: `claude plugin test .`.
- Pipe a fixture to try the script: `echo '{"rate_limits":{"five_hour":{"used_percentage":80,"resets_at":9999999999}}}' | node statusline.mjs`
  (set `CLAUDE_CONFIG_DIR` to a temp folder so the snapshot doesn't touch the real one).
- Try the plugin against a temp `CLAUDE_CONFIG_DIR`, not the live ~/.claude, unless the user asks.
- Screenshots: `python docs/screenshots.py` (claude-boxed-messages `docs/capture.py`; `docs/demo.mjs` for usage steps).
- Release: bump `version` in `.claude-plugin/plugin.json` **and** both versions in `marketplace.json`, add a CHANGELOG
  entry, merge, then `claude plugin tag . --push` (tags `statusline--vX.Y.Z`).
- README layout and the "Install the whole set" block are shared with the other repos of the set (canonical copy:
  claude-launcher `docs/bundle-section.md`); keep the block between the `bundle:start`/`bundle:end` markers identical.

# claude-statusline

A Claude Code status line with one fixed layout and no config file. One Node file, no dependencies.

```
Opus 5.5 – | 62.0% | main                          41.0% 3d 4hr | 82.0% 1hr 20m
```

- **Left:** model + effort as an arrow (low `↓`, medium `–`, high `↑`, xhigh `↑+`, max `M`, auto `a`), context used,
  git branch (hidden outside a git repo).
- **Context and usage:** context used, plus weekly and 5-hour usage with the time until each resets (on the right).
  Each one **only appears from 50%** (with its separator) and its percentage changes colour as it fills:
  white from 50%, yellow from 65%, orange from 75%, red from 90%. A reset time stays in the terminal's default colour.
- Usage is also kept in `~/.claude/statusline/usage.json` (merged across sessions), so a fresh session
  shows it before its first reading.

## Install

```powershell
.\install.ps1            # copies to ~/.claude/statusline and sets statusLine in settings.json
.\install.ps1 -Uninstall
```

To change colours, thresholds or the layout, edit the constants at the top of `statusline.mjs`.

## Agent view

`claude agents` draws no status line and no mod surface (checked on Claude Code 2.1.325), so usage can't be
shown there from a status line or plugin.

## Tests

`node --test test/`

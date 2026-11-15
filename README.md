# claude-statusline

A Claude Code status line with one fixed layout and no config file. One Node file, no dependencies.

```
Opus 5.5 medium | 12.0% | main                          41.0% 3d 4hr | 82.0% 1hr 20m
```

- **Left:** model + effort, context used, git branch.
- **Right:** weekly and 5-hour usage with the time until each resets. Each one **only appears from 50%**
  and changes colour as it fills: yellow from 50%, orange from 75%, bold red from 90%.
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

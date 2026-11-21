# claude-statusline

[![CI](https://github.com/lucaslobasso/claude-statusline/actions/workflows/ci.yml/badge.svg)](https://github.com/lucaslobasso/claude-statusline/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Flucaslobasso%2Fclaude-statusline%2Fmain%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#requirements)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](#install)

<p align="center">
  <img src="docs/session.png" alt="Screenshot: a Claude Code session with the status line under the prompt box: model and effort on the left, 5-hour usage and its reset time on the right" width="760">
</p>

A Claude Code status line with no config file to write. Left: model, effort (as an arrow), context used, git branch. Right: your weekly and 5-hour usage with the time until each resets. Context and usage **only appear once they pass 50%**, and turn white, yellow, orange, then red as they fill. Installed as a plugin, so setup is one command and the look is chosen in `/config`.

> Unofficial community project, not affiliated with Anthropic.

**[Requirements](#requirements) · [Install](#install) · [Settings](#settings) · [How it looks](#how-it-looks) · [Update](#update) · [How it works](#how-it-works) · [Troubleshooting](#troubleshooting) · [Uninstall](#uninstall) · [Install the whole set](#install-the-whole-set)**

## Requirements

- Claude Code **2.1.3xx or newer** (`claude --version`), which has the function-hook plugin API (early access; it may change between releases).
- **Node.js 18+** on your `PATH` (the status line is a small Node script with no dependencies). `git` for the branch.
- Usage numbers need a Claude subscription (Pro or Max); with API billing the right side stays empty.

## Install

In a Claude Code session:

```
/plugin install statusline --marketplace lucaslobasso/claude-statusline
```

Or from a shell:

```sh
claude plugin marketplace add lucaslobasso/claude-statusline
claude plugin install statusline@claude-statusline --scope user
```

The status line appears from the next session on. If your `settings.json` already has a different status line, the plugin leaves it alone and tells you; remove it and run `/claude-statusline on`.

## Settings

Change them in `/config` under **statusline**, or at install time with `--config key=value`:

| Setting | Default | Values | What it does |
| --- | --- | --- | --- |
| `enabled` | `true` | true / false | Keep this status line set. Off removes it from `settings.json` |
| `usageFrom` | `50` | 0 to 100 | Context and usage stay hidden below this percent, then show in white. `0` = always shown |
| `yellowFrom` | `65` | 0 to 100 | They turn yellow from here |
| `orangeFrom` | `75` | 0 to 100 | Orange from here |
| `redFrom` | `90` | 0 to 100 | Red from here |
| `showEffort` | `true` | true / false | Effort as an arrow next to the model: low `↓`, medium `–`, high `↑`, xhigh `↑+`, max `M`, auto `a` |
| `showContext` | `true` | true / false | Percent of the context window used |
| `showBranch` | `true` | true / false | Current git branch (hidden outside a git repo) |
| `showResets` | `true` | true / false | Time until each usage window resets |

Context, weekly and 5-hour usage are colored on their own, each by its own percent. Reset times stay in the terminal's default color.

| Command | What it does |
| --- | --- |
| `/claude-statusline status` | Whether it is on, and the settings that differ from the defaults |
| `/claude-statusline off` | Removes it from `settings.json` (and sets `enabled` to false) |
| `/claude-statusline on` | Puts it back |

## How it looks

**A real session** (top of this page).

| Setting / usage | Status line |
| --- | --- |
| Below 50%: hidden | <img src="docs/usage-hidden.png" alt="Model, effort arrow and branch; no context or usage" width="600"> |
| 50–64%: white | <img src="docs/usage-white.png" alt="58.0% in white" width="600"> |
| 65–74%: yellow | <img src="docs/usage-yellow.png" alt="5-hour 70.0% in yellow, weekly 55.0% white" width="600"> |
| 75–89%: orange | <img src="docs/usage-orange.png" alt="5-hour 82.0% orange, context 66.0% yellow" width="600"> |
| 90%+: red | <img src="docs/usage-red.png" alt="weekly 91.0% and 5-hour 96.0% in red" width="600"> |
| `usageFrom=0`: always shown | <img src="docs/usage-always.png" alt="Context, weekly and 5-hour all shown at low values" width="600"> |
| `showEffort`, `showContext`, `showResets` off | <img src="docs/minimal.png" alt="Model, branch and the usage percentages only" width="600"> |

<sub>The top picture is a real Claude Code session captured offscreen. The rows are the real `statusline.mjs` fed made-up usage numbers (`docs/demo.mjs`), so every step can be shown.</sub>

## Update

```sh
claude plugin marketplace update claude-statusline
claude plugin update statusline@claude-statusline
```

Each update moves the script to a new folder; the plugin points `settings.json` at it on the next session start. See [CHANGELOG.md](CHANGELOG.md).

## How it works

Claude Code reads the status line only from `settings.json`, so the plugin keeps a `statusLine` entry there (`node ".../statusline.mjs" [flags]`). It edits only that entry and keeps the rest of the file as it was. It only ever changes an entry that is its own: this plugin's script, the copy the old `install.ps1` made (`~/.claude/statusline/statusline.mjs`), or boxed-messages 1.x's built-in status line, which it replaces.

Claude Code runs the script every few seconds with the session's status as JSON on stdin. Each session only knows its own last usage reading, so readings from all sessions are merged in `~/.claude/statusline/usage.json` (newest window first, then the highest percent). A fresh session shows usage before its first reading. Settings reach the script as flags such as `--usage-from=60 --no-branch`.

## Troubleshooting

- **No status line.** Start a new session, then run `/claude-statusline status`. A notice about "another status line" means your `settings.json` already had one; remove it and run `/claude-statusline on`.
- **"node" is not recognized / an empty bar.** Install Node.js 18+ and make sure `node` runs in a new terminal.
- **No context or usage shown.** They are hidden below `usageFrom` (50% by default). Set `usageFrom` to `0` to always show it. With API billing there are no usage windows.
- **`claude agents` (agent view) shows no status line.** Agent view doesn't run status lines or plugin UI, so usage can't be shown there. [Claude Taskbar](https://github.com/lucaslobasso/claude-taskbar) shows it on the Windows taskbar instead.
- **Coming from the old `install.ps1` version.** Install the plugin; it takes over the old entry. You can delete `~/.claude/statusline/statusline.mjs` afterwards (keep `usage.json`).

## Uninstall

Plugins get no uninstall hook, so remove the entry first:

```
/claude-statusline off
```

Then:

```sh
claude plugin uninstall statusline@claude-statusline
claude plugin marketplace remove claude-statusline
```

If you uninstalled first, delete the `statusLine` block from `~/.claude/settings.json` by hand. `~/.claude/statusline/usage.json` can go too.

<!-- bundle:start (copied from claude-launcher/docs/bundle-section.md; edit it there and copy to all six READMEs) -->
## Install the whole set

This is one of six small tools that work well together. Each installs on its own, or get them all with one command:

| Tool | What it does | Runs on |
| --- | --- | --- |
| [Claude Launcher](https://github.com/lucaslobasso/claude-launcher) | One click from the taskbar or Start menu straight into Claude Code, with a Claude icon and a loading spinner | Windows, macOS |
| [Claude Taskbar](https://github.com/lucaslobasso/claude-taskbar) | Your Claude sessions and usage limits as dots and bars on the Windows taskbar | Windows |
| [boxed-messages](https://github.com/lucaslobasso/claude-boxed-messages) | Colored boxes around your prompts and Claude's replies | Any |
| [claude-statusline](https://github.com/lucaslobasso/claude-statusline) | A status line with model, context, branch, and usage only when it gets high | Any |
| [claude-sessions](https://github.com/lucaslobasso/claude-sessions) | limit-revive resumes unfinished work after the 5-hour or weekly limit resets, context-handoff continues in a fresh session before the context fills, subagentify splits planned work across Opus and Sonnet subagents | Any |
| [language-spinner](https://github.com/lucaslobasso/claude-language-spinner) | The "thinking" spinner shows words in a language you are learning | Any |

**Windows** (PowerShell 7):

```powershell
irm https://raw.githubusercontent.com/lucaslobasso/claude-launcher/main/bundle.ps1 | iex
```

To pick, pass options: `-Only statusline,limit-revive`, `-Skip launcher`, `-List` (show what is installed) or `-Uninstall`:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/lucaslobasso/claude-launcher/main/bundle.ps1))) -Skip taskbar
```

**macOS and Linux:** the plugins work everywhere. On macOS the launcher installs with its own one-liner:

```sh
curl -fsSL https://raw.githubusercontent.com/lucaslobasso/claude-launcher/main/bootstrap.sh | bash
```

The plugins, in a shell:

```sh
for p in boxed-messages statusline language-spinner; do
  claude plugin marketplace add "lucaslobasso/claude-$p"
  claude plugin install "$p@claude-$p" --scope user
done
claude plugin marketplace add lucaslobasso/claude-sessions
for p in limit-revive context-handoff subagentify; do
  claude plugin install "$p@claude-sessions" --scope user
done
```
<!-- bundle:end -->

## Contributing

```sh
git clone https://github.com/lucaslobasso/claude-statusline
cd claude-statusline
claude --plugin-dir .            # try it in a session
node --test test/                # status line tests
claude plugin test .             # plugin tests (settings.json handling)
claude plugin validate .
```

- Try the script alone: `echo '{"rate_limits":{"five_hour":{"used_percentage":80,"resets_at":9999999999}}}' | node statusline.mjs --usage-from=0` (set `CLAUDE_CONFIG_DIR` to a temp folder so the usage snapshot stays out of your real one).
- `python docs/screenshots.py` retakes the pictures offscreen (needs `pip install pyte pillow pywinpty`).

## License

[MIT](LICENSE) © Lucas Lobasso

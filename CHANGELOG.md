# Changelog

All notable changes to this project. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-11-16

### Changed
- **Now a Claude Code plugin.** Install with `/plugin install statusline --marketplace lucaslobasso/claude-statusline`; it works on Windows, macOS and Linux. The plugin keeps the `statusLine` entry in `settings.json` up to date, editing only that entry, and takes over the entry the old `install.ps1` wrote (and boxed-messages 1.x's built-in one).

### Added
- Settings in `/config`: `enabled`, `usageFrom`, `orangeFrom`, `redFrom`, `showEffort`, `showContext`, `showBranch`, `showResets`. They reach the script as flags (`--usage-from=60 --no-branch`); with no flags it looks exactly as before.
- `/claude-statusline on | off | status`.
- README in the shared layout of the set, with screenshots of every usage step and setting; CI, issue template, CLAUDE.md.

### Removed
- `install.ps1`. Install the plugin instead.

## [1.0.0] - 2026-11-15

### Added
- First version: fixed layout (model, effort, context, branch | weekly and 5-hour usage with resets), usage hidden below 50% and colored yellow / orange / red, merged usage snapshot, Windows `install.ps1`.

[2.0.0]: https://github.com/lucaslobasso/claude-statusline/compare/statusline--v1.0.0...statusline--v2.0.0
[1.0.0]: https://github.com/lucaslobasso/claude-statusline/commits/statusline--v1.0.0

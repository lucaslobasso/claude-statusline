# claude-statusline
- Single file `statusline.mjs`; `node --test test/` must pass. No dependencies.
- Pipe a fixture to try it: `echo '{"rate_limits":{"five_hour":{"used_percentage":80,"resets_at":9999999999}}}' | node statusline.mjs`
  (set `CLAUDE_CONFIG_DIR` to a temp folder so the snapshot doesn't touch the real one).
- Don't install into the live ~/.claude without the user asking: claude-taskbar's usage ring depends on the usage source.

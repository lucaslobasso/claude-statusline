#!/usr/bin/env python3
"""Regenerates every README screenshot:  python docs/screenshots.py [name ...]

Uses the capture script shared by the whole set (claude-boxed-messages docs/capture.py,
downloaded at CAPTURE_REF; set CAPTURE_PY to a local copy to skip the download).
- session.png is a real Claude Code session with this plugin, in a throwaway config folder
  (your login is copied in; your own settings, plugins and history stay out).
- The others run docs/demo.mjs: the real statusline.mjs fed made-up usage numbers, so every
  colour step can be shown without waiting for your usage to get there.
Needs `pip install pyte pillow pywinpty` (ptyprocess instead of pywinpty off Windows), and git.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.request

CAPTURE_REF = 'main'
DOCS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(DOCS)

# file name -> demo.mjs arguments: 5-hour %, weekly %, context %, then statusline flags
DEMOS = {
    'usage-hidden.png': ['31', '22', '23'],
    'usage-white.png': ['58', '41', '30'],
    'usage-yellow.png': ['70', '55', '40'],
    'usage-orange.png': ['82', '55', '66'],
    'usage-red.png': ['96', '91', '92'],
    'usage-always.png': ['18', '9', '12', '--usage-from=0'],
    'minimal.png': ['82', '55', '66', '--no-effort', '--no-context', '--no-resets'],
}


def capture_script(tmp: str) -> str:
    if os.environ.get('CAPTURE_PY'):
        return os.environ['CAPTURE_PY']
    url = f'https://raw.githubusercontent.com/lucaslobasso/claude-boxed-messages/{CAPTURE_REF}/docs/capture.py'
    path = os.path.join(tmp, 'capture.py')
    urllib.request.urlretrieve(url, path)
    return path


def capture(script: str, out: str, cwd: str, extra: list[str], command: list[str]) -> None:
    subprocess.run([sys.executable, script, '--out', os.path.join(DOCS, out), '--cwd', cwd, *extra, '--', *command],
                   check=True)


def main() -> int:
    wanted = sys.argv[1:] or ['session.png', *DEMOS]
    with tempfile.TemporaryDirectory(prefix='statusline-shots-') as tmp:
        script = capture_script(tmp)
        work = os.path.join(tmp, 'my-app')
        os.makedirs(work)
        subprocess.run(['git', 'init', '-q', '-b', 'main', work], check=True)
        env_cfg = os.path.join(tmp, 'cfg')  # demo.mjs writes no snapshot, but keep it off the real one
        os.environ['CLAUDE_CONFIG_DIR'] = env_cfg
        for name in wanted:
            if name == 'session.png':
                del os.environ['CLAUDE_CONFIG_DIR']
                settings = {'promptSuggestionEnabled': False, 'model': 'opus'}
                capture(script, name, work,
                        ['--sandbox', json.dumps(settings), '--wait', '40', '--rows', '22', '--title', 'claude',
                         '--send', 'Say hi in five words.@6', '--send', '\\r@7', '--from-text', 'Say hi in five words'],
                        ['claude', '--plugin-dir', REPO])
                os.environ['CLAUDE_CONFIG_DIR'] = env_cfg
            else:
                capture(script, name, work, ['--wait', '2', '--cols', '110', '--rows', '3', '--no-chrome'],
                        ['node', os.path.join(DOCS, 'demo.mjs'), *DEMOS[name]])
    return 0


if __name__ == '__main__':
    sys.exit(main())

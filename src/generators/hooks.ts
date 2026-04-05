import { ProjectInfo } from '../utils/scanner.js';
import { Preset } from './claudeignore.js';

export interface HookScripts {
  'session-start.sh': string;
  'post-tool.sh': string;
  'pre-compact.sh': string;
}

export function generateHooks(_preset: Preset, _project: ProjectInfo): HookScripts {
  const sessionStart = `#!/bin/sh
# session-start.sh — record session start for token tracking

# Check git is available before running git commands
if ! command -v git >/dev/null 2>&1; then
  echo "cts session-start: git not available, skipping project detection" >&2
  PROJECT="unknown"
else
  PROJECT=$(git rev-parse --show-toplevel 2>/dev/null || echo "unknown")
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DATA_DIR=\${CTS_DATA_DIR:-"\$HOME/.claude-token-saver"}
TRACKING_FILE="\$DATA_DIR/tracking.json"

mkdir -p "\$DATA_DIR"

if [ ! -f "\$TRACKING_FILE" ]; then
  echo '{"sessions":[]}' > "\$TRACKING_FILE"
fi

# Append session entry using node if available, otherwise skip
if command -v node >/dev/null 2>&1; then
  node - "\$TRACKING_FILE" "\$TIMESTAMP" "\$PROJECT" <<'EOF'
const fs = require('fs');
const [,, file, timestamp, project] = process.argv;
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { data = { sessions: [] }; }
data.sessions.push({ timestamp, project });
fs.writeFileSync(file, JSON.stringify(data, null, 2));
EOF
else
  echo "cts session-start: node not available, skipping session record" >&2
fi
`;

  const postTool = `#!/bin/sh
# post-tool.sh — record tool usage for token tracking

# Check node is available
if ! command -v node >/dev/null 2>&1; then
  echo "cts post-tool: node not available, skipping" >&2
  exit 0
fi

DATA_DIR=\${CTS_DATA_DIR:-"\$HOME/.claude-token-saver"}
TRACKING_FILE="\$DATA_DIR/tracking.json"

if [ ! -f "\$TRACKING_FILE" ]; then
  exit 0
fi

# Pass tool usage data via stdin (Claude Code provides JSON on stdin)
node - "\$TRACKING_FILE" <<'EOF'
const fs = require('fs');
const [,, file] = process.argv;
let input = '';
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  let event;
  try { event = JSON.parse(input); } catch { process.exit(0); }
  let data;
  try { data = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { data = { sessions: [] }; }
  if (!data.toolCalls) data.toolCalls = [];
  data.toolCalls.push({ timestamp: new Date().toISOString(), event });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
});
EOF
`;

  const preCompact = `#!/bin/sh
# pre-compact.sh — save context summary before compaction

DATA_DIR=\${CTS_DATA_DIR:-"\$HOME/.claude-token-saver"}
SUMMARY_DIR="\$DATA_DIR/compaction-summaries"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "\$SUMMARY_DIR"

# Claude Code passes the summary on stdin during pre-compact
SUMMARY_FILE="\$SUMMARY_DIR/\$TIMESTAMP.txt"
cat > "\$SUMMARY_FILE"

echo "cts pre-compact: saved summary to \$SUMMARY_FILE" >&2
`;

  return {
    'session-start.sh': sessionStart,
    'post-tool.sh': postTool,
    'pre-compact.sh': preCompact,
  };
}

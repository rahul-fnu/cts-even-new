# claude-token-saver

> Optimize your Claude Code token usage — automatically.

[![npm version](https://img.shields.io/npm/v/claude-token-saver.svg)](https://www.npmjs.com/package/claude-token-saver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

`claude-token-saver` (also aliased as `cts`) is a CLI tool that audits your project for token-wasting patterns, generates optimized Claude configuration files (`.claudeignore`, `CLAUDE.md`, `settings.json`, hooks), and tracks your token consumption over time.

---

## Quick Start

```bash
# Install globally
npm install -g claude-token-saver

# Or run directly with npx (no install needed)
npx claude-token-saver init
```

Both `claude-token-saver` and the shorter `cts` alias work interchangeably:

```bash
cts init
cts audit
cts generate
cts track
```

---

## Commands

### `init` — Bootstrap a project

Scaffolds all Claude configuration files in one step. Detects the project type (Node.js, Python, etc.) and applies language-specific defaults.

```bash
cts init [options]

Options:
  --preset <name>   Optimization preset: minimal | balanced | aggressive  (default: balanced)
  --force           Overwrite existing config files
  --dry-run         Preview files that would be created without writing them
```

**Examples:**

```bash
# Initialize with defaults (balanced preset)
cts init

# Initialize a Python project with aggressive token optimization
cts init --preset aggressive

# Preview what would be created without writing any files
cts init --dry-run
```

Files created:

| File | Purpose |
|------|---------|
| `.claudeignore` | Tells Claude Code which files to exclude from context |
| `CLAUDE.md` | Project-level instructions and conventions for Claude |
| `.claude/settings.json` | Claude Code settings (token limits, model prefs) |
| `.claude/hooks/` | Pre/post-tool hooks for automated context management |

For **Node.js** projects, `.claudeignore` automatically excludes `node_modules/`, `dist/`, `build/`, `coverage/`, `*.lock` files, and other build artifacts.

For **Python** projects, it excludes `__pycache__/`, `*.pyc`, `.venv/`, `site-packages/`, `.pytest_cache/`, and similar.

---

### `audit` — Find token-wasting patterns

Scans your project for issues that inflate token usage and reports them with severity ratings and fix suggestions.

```bash
cts audit [options]

Options:
  --fix             Automatically apply suggested fixes where possible
  --format <fmt>    Output format: text | json  (default: text)
  --threshold <n>   Exit with code 1 if issues exceed this count
```

**Examples:**

```bash
# Audit and display issues
cts audit

# Audit and auto-fix safe issues
cts audit --fix

# Use JSON output for CI integration
cts audit --format json

# Fail CI if more than 5 issues found
cts audit --threshold 5
```

**Sample output:**

```
claude-token-saver audit results
─────────────────────────────────
✖ [HIGH]   node_modules/ not in .claudeignore (+120,000 tokens/session)
✖ [HIGH]   No CLAUDE.md found — Claude reads full codebase for context
⚠ [MEDIUM] dist/ not excluded — compiled output wastes tokens
⚠ [MEDIUM] Large binary files (*.png, *.pdf) included in context
ℹ [LOW]    coverage/ directory not excluded

5 issues found (2 high, 2 medium, 1 low)
Run `cts audit --fix` to auto-apply safe fixes.
```

---

### `generate` — Regenerate individual config files

Regenerates one or more Claude configuration files without touching the rest of your setup. Useful for refreshing a single file after changing presets.

```bash
cts generate [files...] [options]

Files:
  claudeignore    Regenerate .claudeignore
  claudemd        Regenerate CLAUDE.md
  settings        Regenerate .claude/settings.json
  hooks           Regenerate .claude/hooks/

Options:
  --preset <name>   Preset to use: minimal | balanced | aggressive  (default: balanced)
  --force           Overwrite existing file
```

**Examples:**

```bash
# Regenerate .claudeignore only
cts generate claudeignore

# Regenerate all files with aggressive preset
cts generate --preset aggressive

# Regenerate settings and hooks, overwriting existing
cts generate settings hooks --force
```

---

### `track` — Monitor token usage over time

Records, displays, and exports your Claude Code token consumption.

```bash
cts track [options]

Options:
  --log <tokens>    Log a token usage event (e.g., --log 50000)
  --export          Export usage history as CSV
  --reset           Clear all stored usage data
```

**Examples:**

```bash
# Show the usage dashboard
cts track

# Log a session that used 50,000 tokens
cts track --log 50000

# Export usage history to CSV
cts track --export > usage.csv
```

**Dashboard output:**

```
Claude Token Usage Dashboard
─────────────────────────────────────────
Today          :  47,320 tokens
This week      : 218,900 tokens
This month     : 892,440 tokens
All time       :   2.1M tokens

Recent sessions:
  2026-04-05 14:32  50,000 tokens
  2026-04-05 11:14  32,800 tokens
  2026-04-04 16:45  61,200 tokens
```

**CSV export format:**

```
date,tokens,session_id
2026-04-05T14:32:00Z,50000,abc123
2026-04-05T11:14:00Z,32800,def456
```

---

## How It Saves Tokens

Every token counts against your rate limits and billing. Here's what `claude-token-saver` targets:

| Optimization | What it does | Typical token savings |
|---|---|---|
| `.claudeignore` | Excludes `node_modules/`, `dist/`, build artifacts from context | 50,000–200,000 per session |
| `CLAUDE.md` conventions | Gives Claude precise instructions so it doesn't explore blindly | 10,000–30,000 per session |
| Binary/asset exclusion | Keeps images, PDFs, fonts out of context reads | 5,000–50,000 per session |
| Lock file exclusion | `package-lock.json`, `yarn.lock`, `poetry.lock` rarely help Claude | 2,000–10,000 per session |
| Large generated files | Compiled CSS, minified JS, auto-generated code | 5,000–40,000 per session |
| Test fixtures & snapshots | Jest snapshots, large fixture data | 3,000–20,000 per session |
| Hook-based context trimming | Pre-tool hooks strip redundant context before each tool call | 5,000–15,000 per session |
| Coverage & cache dirs | `.nyc_output/`, `.pytest_cache/`, `.next/cache/` | 1,000–10,000 per session |

**Cumulative effect:** A well-configured project typically reduces per-session token usage by **40–70%**.

---

## Presets

Choose the right tradeoff between convenience and optimization:

| Feature | `minimal` | `balanced` | `aggressive` |
|---|---|---|---|
| Exclude `node_modules/` | ✓ | ✓ | ✓ |
| Exclude `dist/` & `build/` | ✗ | ✓ | ✓ |
| Exclude lock files | ✗ | ✓ | ✓ |
| Exclude test fixtures | ✗ | ✓ | ✓ |
| Exclude coverage dirs | ✗ | ✓ | ✓ |
| Exclude binary assets | ✗ | ✓ | ✓ |
| Exclude generated code | ✗ | ✗ | ✓ |
| Restrict `CLAUDE.md` scope | ✗ | ✗ | ✓ |
| Hook-based context trimming | ✗ | ✗ | ✓ |
| Token budget in settings | ✗ | ✗ | ✓ |
| **Estimated savings** | 30–40% | 50–60% | 60–70% |

Use `balanced` for most projects. Use `aggressive` when you're hitting rate limits or working in a very large monorepo.

---

## Typical Workflow

Here's a step-by-step example for a new Node.js project:

**1. Audit your current setup:**

```bash
cd my-project
cts audit
# → Reports: node_modules/ not excluded, no CLAUDE.md, dist/ included
```

**2. Initialize with the balanced preset:**

```bash
cts init --preset balanced
# → Creates .claudeignore, CLAUDE.md, .claude/settings.json, .claude/hooks/
```

**3. Verify the audit is clean:**

```bash
cts audit
# → No issues found
```

**4. Work with Claude Code as normal, then log your session:**

```bash
cts track --log 45000
```

**5. Check your usage dashboard periodically:**

```bash
cts track
# → Shows today / weekly / monthly breakdown
```

**6. Export data for reporting:**

```bash
cts track --export > token-usage-april.csv
```

---

## Docker Usage

When running Claude Code in a container, mount the data directory so tracking data persists across container restarts:

```bash
docker run \
  -v "$HOME/.cts-data:/root/.cts-data" \
  -e CTS_DATA_DIR=/root/.cts-data \
  my-claude-image
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CTS_DATA_DIR` | `~/.cts-data` | Directory where tracking data is stored |
| `CTS_PRESET` | `balanced` | Default preset for `init` and `generate` |
| `CTS_NO_COLOR` | unset | Set to `1` to disable color output |

### Merging tracking data from multiple containers

If you run Claude Code sessions across multiple containers or machines, merge the data files before viewing the dashboard:

```bash
cts track --merge /path/to/other-data/usage.json
cts track  # Dashboard now shows combined data
```

---

## Data Storage

Token tracking data is stored as line-delimited JSON in:

```
~/.cts-data/
└── usage.jsonl      # One record per tracked session
```

Each record looks like:

```json
{"date":"2026-04-05T14:32:00Z","tokens":50000,"session_id":"abc123"}
```

**Exporting:**

```bash
cts track --export          # Print CSV to stdout
cts track --export > out.csv  # Save to file
```

**Resetting:**

```bash
cts track --reset           # Deletes all stored usage data
```

---

## Requirements

- **Node.js** >= 18
- **[Claude Code CLI](https://claude.ai/code)** installed and authenticated (required for hook integration and token tracking)

---

## License

MIT © claude-token-saver contributors

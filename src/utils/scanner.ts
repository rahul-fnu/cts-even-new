import fs from 'fs';
import path from 'path';

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'java' | 'ruby' | 'mixed' | 'unknown';
export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface LargeFile {
  path: string;
  sizeKb: number;
  lines: number;
}

export interface AuditIssue {
  severity: IssueSeverity;
  category: string;
  message: string;
  fix: string;
  tokenImpact: string;
}

export interface ProjectInfo {
  root: string;
  type: ProjectType;
  hasClaudeMd: boolean;
  hasClaudeIgnore: boolean;
  hasClaudeSettings: boolean;
  hasClaudeHooks: boolean;
  claudeMdLines: number;
  largeDirs: string[];
  largeFiles: LargeFile[];
  lockFiles: string[];
  buildDirs: string[];
  totalFiles: number;
  mcpServers: string[];
  issues: AuditIssue[];
}

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.next', 'out', 'build', 'target',
  '__pycache__', '.git', '.svn', 'vendor', 'coverage', '.cache',
  '.parcel-cache', '.turbo', '.vite', 'venv', '.venv', 'env',
]);

const LOCK_FILE_NAMES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Pipfile.lock',
  'poetry.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
];

const BUILD_DIR_NAMES = [
  'dist', 'build', '.next', 'out', 'target', '__pycache__',
  '.turbo', '.parcel-cache', '.vite', 'coverage',
];

function detectProjectType(root: string): ProjectType {
  const markers: Record<string, ProjectType> = {
    'package.json': 'node',
    'requirements.txt': 'python',
    'pyproject.toml': 'python',
    'Cargo.toml': 'rust',
    'go.mod': 'go',
    'pom.xml': 'java',
    'build.gradle': 'java',
    'Gemfile': 'ruby',
  };

  const detected = new Set<ProjectType>();
  for (const [file, type] of Object.entries(markers)) {
    if (fs.existsSync(path.join(root, file))) {
      detected.add(type);
    }
  }

  if (detected.size === 0) return 'unknown';
  if (detected.size === 1) return [...detected][0];
  return 'mixed';
}

export function findLargeFiles(root: string, maxDepth = 3): LargeFile[] {
  const results: LargeFile[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(filePath);
        } catch {
          continue;
        }
        const sizeKb = stat.size / 1024;
        if (sizeKb > 100) {
          let lines = 0;
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            lines = content.split('\n').length;
          } catch {
            // binary file or unreadable — lines stays 0
          }
          results.push({ path: filePath, sizeKb: Math.round(sizeKb * 10) / 10, lines });
        }
      }
    }
  }

  walk(root, 0);
  results.sort((a, b) => b.sizeKb - a.sizeKb);
  return results.slice(0, 20);
}

export function countFiles(root: string): number {
  let count = 0;

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        count++;
      }
    }
  }

  walk(root);
  return count;
}

function detectLockFiles(root: string): string[] {
  return LOCK_FILE_NAMES.filter((f) => fs.existsSync(path.join(root, f)));
}

function detectBuildDirs(root: string): string[] {
  return BUILD_DIR_NAMES.filter((d) => {
    try {
      return fs.statSync(path.join(root, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

function readClaudeIgnore(root: string): string[] {
  const p = path.join(root, '.claudeignore');
  try {
    return fs.readFileSync(p, 'utf-8').split('\n');
  } catch {
    return [];
  }
}

function readSettings(root: string): Record<string, unknown> | null {
  const p = path.join(root, '.claude', 'settings.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getMcpServers(settings: Record<string, unknown> | null): string[] {
  if (!settings) return [];
  const mcp = settings['mcpServers'];
  if (mcp && typeof mcp === 'object' && !Array.isArray(mcp)) {
    return Object.keys(mcp as Record<string, unknown>);
  }
  return [];
}

function isIgnored(filePath: string, ignoreLines: string[]): boolean {
  const rel = path.basename(filePath);
  return ignoreLines.some((line) => {
    const pattern = line.trim();
    if (!pattern || pattern.startsWith('#')) return false;
    return rel === pattern || filePath.includes(pattern.replace(/\*/g, ''));
  });
}

export function runAudit(info: Omit<ProjectInfo, 'issues'>): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const ignoreLines = readClaudeIgnore(info.root);
  const settings = readSettings(info.root);

  // 1. Missing .claudeignore (critical)
  if (!info.hasClaudeIgnore) {
    issues.push({
      severity: 'critical',
      category: 'ignore',
      message: 'No .claudeignore file found',
      fix: 'Run `cts init` or create a .claudeignore file to exclude large/generated files from Claude context',
      tokenImpact: 'High — Claude reads all unignored files, wasting tokens on irrelevant content',
    });
  }

  // 2. Bloated CLAUDE.md (warning) — > 200 lines
  if (info.hasClaudeMd && info.claudeMdLines > 200) {
    issues.push({
      severity: 'warning',
      category: 'claude-md',
      message: `CLAUDE.md is ${info.claudeMdLines} lines (recommended: ≤200)`,
      fix: 'Trim CLAUDE.md to essential project context; move verbose docs to separate files',
      tokenImpact: 'Medium — CLAUDE.md is loaded on every session',
    });
  }

  // 3. Missing CLAUDE.md (warning)
  if (!info.hasClaudeMd) {
    issues.push({
      severity: 'warning',
      category: 'claude-md',
      message: 'No CLAUDE.md file found',
      fix: 'Create CLAUDE.md with project context, coding conventions, and key architecture notes',
      tokenImpact: 'Medium — without CLAUDE.md, Claude lacks project context and may ask redundant questions',
    });
  }

  // 4. Missing settings (warning)
  if (!info.hasClaudeSettings) {
    issues.push({
      severity: 'warning',
      category: 'settings',
      message: 'No .claude/settings.json file found',
      fix: 'Create .claude/settings.json to configure Claude behaviour for this project',
      tokenImpact: 'Low — missing settings means default behaviour with no project-specific optimisations',
    });
  }

  // 5. Autocompact not set (warning)
  if (settings) {
    const env = settings['env'] as Record<string, unknown> | undefined;
    const hasAutocompact =
      (env && 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE' in env) ||
      'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE' in settings;
    if (!hasAutocompact) {
      issues.push({
        severity: 'warning',
        category: 'settings',
        message: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE is not set in .claude/settings.json',
        fix: 'Add "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE" to the env block in .claude/settings.json to control auto-compaction',
        tokenImpact: 'Medium — without auto-compaction tuning, context may bloat unnecessarily',
      });
    }

    // 6. Thinking uncapped (info)
    const hasMaxThinking =
      (env && 'MAX_THINKING_TOKENS' in env) ||
      'MAX_THINKING_TOKENS' in settings;
    if (!hasMaxThinking) {
      issues.push({
        severity: 'info',
        category: 'settings',
        message: 'MAX_THINKING_TOKENS is not set in .claude/settings.json',
        fix: 'Set MAX_THINKING_TOKENS in the env block of .claude/settings.json to cap extended thinking token usage',
        tokenImpact: 'Low — uncapped thinking tokens can lead to unexpectedly high token consumption',
      });
    }

    // 9. Too many MCPs (warning) — > 3
    if (info.mcpServers.length > 3) {
      issues.push({
        severity: 'warning',
        category: 'mcp',
        message: `${info.mcpServers.length} MCP servers configured (recommended: ≤3)`,
        fix: 'Remove unused MCP servers from .claude/settings.json to reduce tool-listing overhead',
        tokenImpact: 'Medium — each MCP server adds tool definitions to every request',
      });
    }
  }

  // 7. Large generated files not in .claudeignore (warning)
  const generatedExts = new Set(['.json', '.lock', '.log', '.map']);
  const minifiedPattern = /\.min\.js$/;
  for (const lf of info.largeFiles) {
    const ext = path.extname(lf.path);
    const isGenerated = generatedExts.has(ext) || minifiedPattern.test(lf.path);
    if (isGenerated && !isIgnored(lf.path, ignoreLines)) {
      issues.push({
        severity: 'warning',
        category: 'large-files',
        message: `Large generated file not in .claudeignore: ${path.relative(info.root, lf.path)} (${lf.sizeKb}KB)`,
        fix: `Add the file or its pattern to .claudeignore`,
        tokenImpact: `High — ${lf.sizeKb}KB file loaded into context unnecessarily`,
      });
    }
  }

  // 8. Lock files exposed (warning) — lock files exist + no .claudeignore
  if (info.lockFiles.length > 0 && !info.hasClaudeIgnore) {
    issues.push({
      severity: 'warning',
      category: 'lock-files',
      message: `Lock files present but no .claudeignore: ${info.lockFiles.join(', ')}`,
      fix: 'Add lock files to .claudeignore (e.g. package-lock.json, yarn.lock)',
      tokenImpact: 'High — lock files are large and rarely useful to Claude',
    });
  }

  // 10. Build dirs exposed (info) — build dirs exist + no .claudeignore
  if (info.buildDirs.length > 0 && !info.hasClaudeIgnore) {
    issues.push({
      severity: 'info',
      category: 'build-dirs',
      message: `Build directories present but no .claudeignore: ${info.buildDirs.join(', ')}`,
      fix: 'Add build directories to .claudeignore (e.g. dist/, build/, .next/)',
      tokenImpact: 'Medium — build output files bloat Claude context',
    });
  }

  // 11. No hooks (info)
  if (!info.hasClaudeHooks) {
    issues.push({
      severity: 'info',
      category: 'hooks',
      message: 'No .claude/hooks/ directory found',
      fix: 'Create .claude/hooks/ and add lifecycle hooks to automate token-saving workflows',
      tokenImpact: 'Low — hooks can automate compaction and other token-saving actions',
    });
  }

  return issues;
}

export function scanProject(root: string): ProjectInfo {
  const resolvedRoot = path.resolve(root);

  const hasClaudeMd = fs.existsSync(path.join(resolvedRoot, 'CLAUDE.md'));
  const hasClaudeIgnore = fs.existsSync(path.join(resolvedRoot, '.claudeignore'));
  const hasClaudeSettings = fs.existsSync(path.join(resolvedRoot, '.claude', 'settings.json'));
  const hasClaudeHooks = (() => {
    try {
      return fs.statSync(path.join(resolvedRoot, '.claude', 'hooks')).isDirectory();
    } catch {
      return false;
    }
  })();

  let claudeMdLines = 0;
  if (hasClaudeMd) {
    try {
      claudeMdLines = fs.readFileSync(path.join(resolvedRoot, 'CLAUDE.md'), 'utf-8').split('\n').length;
    } catch {
      claudeMdLines = 0;
    }
  }

  const settings = readSettings(resolvedRoot);
  const mcpServers = getMcpServers(settings);
  const lockFiles = detectLockFiles(resolvedRoot);
  const buildDirs = detectBuildDirs(resolvedRoot);
  const largeFiles = findLargeFiles(resolvedRoot);
  const totalFiles = countFiles(resolvedRoot);
  const projectType = detectProjectType(resolvedRoot);

  // Detect dirs that are over some threshold — we report known large dirs present in root
  const largeDirs = [...SKIP_DIRS].filter((d) => {
    try {
      return fs.statSync(path.join(resolvedRoot, d)).isDirectory();
    } catch {
      return false;
    }
  });

  const base: Omit<ProjectInfo, 'issues'> = {
    root: resolvedRoot,
    type: projectType,
    hasClaudeMd,
    hasClaudeIgnore,
    hasClaudeSettings,
    hasClaudeHooks,
    claudeMdLines,
    largeDirs,
    largeFiles,
    lockFiles,
    buildDirs,
    totalFiles,
    mcpServers,
  };

  const issues = runAudit(base);

  return { ...base, issues };
}

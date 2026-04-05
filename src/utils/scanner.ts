import fs from 'fs';
import path from 'path';

export interface AuditIssue {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
}

export interface LargeFile {
  path: string;
  sizeKB: number;
  lineCount: number;
}

export interface ProjectInfo {
  projectType: string;
  fileCount: number;
  claudeMd: {
    exists: boolean;
    lineCount?: number;
  };
  claudeIgnore: {
    exists: boolean;
  };
  settings: {
    exists: boolean;
  };
  hooks: {
    exists: boolean;
  };
  lockFiles: string[];
  buildDirs: string[];
  mcpServers: string[];
  largeFiles: LargeFile[];
  issues: AuditIssue[];
  score: number;
}

const BUILD_DIRS = [
  'node_modules',
  'dist',
  'build',
  '__pycache__',
  '.next',
  '.nuxt',
  'target',
  'vendor',
  '.venv',
  'venv',
  'coverage',
  '.nyc_output',
  '.pytest_cache',
  '.cache',
  '.parcel-cache',
  'out',
  '.turbo',
];

const LOCK_FILE_NAMES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'go.sum',
  'composer.lock',
  'Pipfile.lock',
];

const SKIP_DIRS_FOR_COUNT = new Set([
  ...BUILD_DIRS,
  '.git',
]);

function detectProjectType(dir: string): string {
  const checks: Array<[string, string[]]> = [
    ['node', ['package.json']],
    ['python', ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg']],
    ['rust', ['Cargo.toml']],
    ['go', ['go.mod']],
    ['ruby', ['Gemfile']],
    ['php', ['composer.json']],
  ];

  const detected = checks
    .filter(([, files]) => files.some((f) => fs.existsSync(path.join(dir, f))))
    .map(([lang]) => lang);

  if (detected.length === 0) return 'unknown';
  if (detected.length === 1) return detected[0];
  return 'mixed';
}

function countFiles(dir: string): number {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS_FOR_COUNT.has(entry.name)) {
          count += countFiles(path.join(dir, entry.name));
        }
      } else {
        count++;
      }
    }
  } catch {
    // ignore permission errors
  }
  return count;
}

function detectLockFiles(dir: string): string[] {
  return LOCK_FILE_NAMES.filter((name) => fs.existsSync(path.join(dir, name)));
}

function detectBuildDirs(dir: string): string[] {
  return BUILD_DIRS.filter((name) => fs.existsSync(path.join(dir, name)));
}

function detectMcpServers(dir: string): string[] {
  const settingsPath = path.join(dir, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return [];
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const mcp = settings.mcpServers as Record<string, unknown> | undefined;
    if (mcp && typeof mcp === 'object') {
      return Object.keys(mcp);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

interface FileEntry {
  path: string;
  size: number;
}

function collectLargeFiles(dir: string, rootDir: string, results: FileEntry[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS_FOR_COUNT.has(entry.name)) {
          collectLargeFiles(fullPath, rootDir, results);
        }
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 10 * 1024) {
            // Only track files > 10KB
            results.push({ path: path.relative(rootDir, fullPath), size: stat.size });
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
}

function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function getLargeFiles(dir: string): LargeFile[] {
  const entries: FileEntry[] = [];
  collectLargeFiles(dir, dir, entries);
  entries.sort((a, b) => b.size - a.size);
  const top8 = entries.slice(0, 8);
  return top8.map((e) => ({
    path: e.path,
    sizeKB: Math.round(e.size / 1024),
    lineCount: countLines(path.join(dir, e.path)),
  }));
}

function readClaudeMd(dir: string): { exists: boolean; lineCount?: number } {
  const filePath = path.join(dir, 'CLAUDE.md');
  if (!fs.existsSync(filePath)) return { exists: false };
  const lineCount = countLines(filePath);
  return { exists: true, lineCount };
}

function generateIssues(info: Omit<ProjectInfo, 'issues' | 'score'>): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (info.buildDirs.includes('node_modules')) {
    issues.push({
      severity: 'HIGH',
      category: 'Build Artifacts',
      message: 'node_modules/ not in .claudeignore (+120,000 tokens/session)',
    });
  }

  if (!info.claudeMd.exists) {
    issues.push({
      severity: 'HIGH',
      category: 'Configuration',
      message: 'No CLAUDE.md found — Claude reads full codebase for context',
    });
  } else if (info.claudeMd.lineCount !== undefined && info.claudeMd.lineCount > 500) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Configuration',
      message: `CLAUDE.md is very long (${info.claudeMd.lineCount} lines) — consider trimming`,
    });
  }

  if (!info.claudeIgnore.exists) {
    issues.push({
      severity: 'HIGH',
      category: 'Configuration',
      message: 'No .claudeignore found — all project files included in context',
    });
  }

  for (const dir of ['dist', 'build', '.next', '.nuxt', 'out']) {
    if (info.buildDirs.includes(dir)) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Build Artifacts',
        message: `${dir}/ not excluded — compiled output wastes tokens`,
      });
    }
  }

  if (info.lockFiles.length > 0) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Lock Files',
      message: `Lock files included in context: ${info.lockFiles.join(', ')}`,
    });
  }

  for (const dir of ['coverage', '.nyc_output', '.pytest_cache', '__pycache__']) {
    if (info.buildDirs.includes(dir)) {
      issues.push({
        severity: 'LOW',
        category: 'Cache Directories',
        message: `${dir}/ directory not excluded`,
      });
    }
  }

  if (!info.settings.exists) {
    issues.push({
      severity: 'LOW',
      category: 'Configuration',
      message: 'No .claude/settings.json — token budget not configured',
    });
  }

  if (!info.hooks.exists) {
    issues.push({
      severity: 'LOW',
      category: 'Configuration',
      message: 'No .claude/hooks/ — hook-based context trimming not set up',
    });
  }

  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  const hasBinaryLargeFiles = info.largeFiles.some((f) =>
    binaryExtensions.some((ext) => f.path.endsWith(ext))
  );
  if (hasBinaryLargeFiles) {
    issues.push({
      severity: 'MEDIUM',
      category: 'Binary Files',
      message: 'Large binary files (images, fonts, PDFs) included in context',
    });
  }

  return issues;
}

function calculateScore(issues: AuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'HIGH') score -= 15;
    else if (issue.severity === 'MEDIUM') score -= 8;
    else if (issue.severity === 'LOW') score -= 3;
  }
  return Math.max(0, score);
}

export function scanProject(dir: string): ProjectInfo {
  const projectType = detectProjectType(dir);
  const fileCount = countFiles(dir);
  const claudeMd = readClaudeMd(dir);
  const claudeIgnore = { exists: fs.existsSync(path.join(dir, '.claudeignore')) };
  const settings = { exists: fs.existsSync(path.join(dir, '.claude', 'settings.json')) };
  const hooksDir = path.join(dir, '.claude', 'hooks');
  const hooks = {
    exists: fs.existsSync(hooksDir) && fs.readdirSync(hooksDir).length > 0,
  };
  const lockFiles = detectLockFiles(dir);
  const buildDirs = detectBuildDirs(dir);
  const mcpServers = detectMcpServers(dir);
  const largeFiles = getLargeFiles(dir);

  const partial = {
    projectType,
    fileCount,
    claudeMd,
    claudeIgnore,
    settings,
    hooks,
    lockFiles,
    buildDirs,
    mcpServers,
    largeFiles,
  };

  const issues = generateIssues(partial);
  const score = calculateScore(issues);

  return { ...partial, issues, score };
}

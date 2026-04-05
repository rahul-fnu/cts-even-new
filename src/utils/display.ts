import chalk from 'chalk';
import type { AuditIssue, LargeFile, ProjectInfo } from './scanner.js';

const SEVERITY_ICON: Record<string, string> = {
  HIGH: '✖',
  MEDIUM: '⚠',
  LOW: 'ℹ',
};

const SEVERITY_COLOR: Record<string, (s: string) => string> = {
  HIGH: chalk.red,
  MEDIUM: chalk.yellow,
  LOW: chalk.cyan,
};

export function printBanner(): void {
  console.log();
  console.log(chalk.bold.cyan('claude-token-saver audit'));
  console.log(chalk.dim('─'.repeat(40)));
}

export function printProjectSummary(info: ProjectInfo): void {
  console.log();
  console.log(chalk.bold('Project Summary'));
  console.log(chalk.dim('─'.repeat(40)));

  const row = (label: string, value: string) => {
    const paddedLabel = label.padEnd(22);
    console.log(`  ${chalk.dim(paddedLabel)} ${value}`);
  };

  row('Type:', chalk.white(info.projectType));
  row('Files:', chalk.white(String(info.fileCount)));

  const claudeMdStatus = info.claudeMd.exists
    ? chalk.green(`yes (${info.claudeMd.lineCount ?? 0} lines)`)
    : chalk.red('missing');
  row('CLAUDE.md:', claudeMdStatus);

  row('.claudeignore:', info.claudeIgnore.exists ? chalk.green('yes') : chalk.red('missing'));
  row('settings.json:', info.settings.exists ? chalk.green('yes') : chalk.yellow('missing'));
  row('hooks:', info.hooks.exists ? chalk.green('yes') : chalk.yellow('missing'));

  if (info.lockFiles.length > 0) {
    row('Lock files:', chalk.yellow(info.lockFiles.join(', ')));
  } else {
    row('Lock files:', chalk.dim('none'));
  }

  if (info.buildDirs.length > 0) {
    row('Build dirs:', chalk.yellow(info.buildDirs.join(', ')));
  } else {
    row('Build dirs:', chalk.dim('none'));
  }

  if (info.mcpServers.length > 0) {
    row('MCP servers:', chalk.white(info.mcpServers.join(', ')));
  } else {
    row('MCP servers:', chalk.dim('none'));
  }
}

export function printLargeFiles(files: LargeFile[]): void {
  if (files.length === 0) return;

  console.log();
  console.log(chalk.bold('Largest Files'));
  console.log(chalk.dim('─'.repeat(40)));

  const pathWidth = Math.min(
    50,
    Math.max(20, ...files.map((f) => f.path.length))
  );

  const header =
    '  ' +
    'Path'.padEnd(pathWidth) +
    '  ' +
    'Size (KB)'.padStart(10) +
    '  ' +
    'Lines'.padStart(8);
  console.log(chalk.dim(header));
  console.log(chalk.dim('  ' + '─'.repeat(pathWidth + 24)));

  for (const file of files) {
    const truncatedPath = file.path.length > pathWidth
      ? '...' + file.path.slice(-(pathWidth - 3))
      : file.path;
    const line =
      '  ' +
      truncatedPath.padEnd(pathWidth) +
      '  ' +
      String(file.sizeKB).padStart(10) +
      '  ' +
      String(file.lineCount).padStart(8);
    console.log(line);
  }
}

export function printIssues(issues: AuditIssue[]): void {
  console.log();
  console.log(chalk.bold('Issues Found'));
  console.log(chalk.dim('─'.repeat(40)));

  if (issues.length === 0) {
    console.log(chalk.green('  ✓ No issues found — your project is well optimized!'));
    return;
  }

  // Group by category
  const byCategory: Record<string, AuditIssue[]> = {};
  for (const issue of issues) {
    if (!byCategory[issue.category]) byCategory[issue.category] = [];
    byCategory[issue.category].push(issue);
  }

  for (const [category, categoryIssues] of Object.entries(byCategory)) {
    console.log();
    console.log(chalk.bold(`  ${category}`));
    for (const issue of categoryIssues) {
      const icon = SEVERITY_ICON[issue.severity] ?? '?';
      const colorFn = SEVERITY_COLOR[issue.severity] ?? chalk.white;
      const badge = colorFn(`[${issue.severity}]`);
      console.log(`  ${colorFn(icon)} ${badge} ${issue.message}`);
    }
  }

  const highCount = issues.filter((i) => i.severity === 'HIGH').length;
  const medCount = issues.filter((i) => i.severity === 'MEDIUM').length;
  const lowCount = issues.filter((i) => i.severity === 'LOW').length;

  const parts: string[] = [];
  if (highCount > 0) parts.push(chalk.red(`${highCount} high`));
  if (medCount > 0) parts.push(chalk.yellow(`${medCount} medium`));
  if (lowCount > 0) parts.push(chalk.cyan(`${lowCount} low`));

  console.log();
  console.log(`  ${chalk.bold(String(issues.length))} issues found (${parts.join(', ')})`);
}

export function printScore(score: number, issues: AuditIssue[]): void {
  console.log();
  console.log(chalk.bold('Efficiency Score'));
  console.log(chalk.dim('─'.repeat(40)));

  const barLength = 30;
  const filled = Math.round((score / 100) * barLength);
  const empty = barLength - filled;

  let barColor: (s: string) => string;
  if (score >= 80) barColor = chalk.green;
  else if (score >= 50) barColor = chalk.yellow;
  else barColor = chalk.red;

  const bar = barColor('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  console.log(`  ${bar} ${chalk.bold(String(score))}/100`);

  let label: string;
  if (score >= 90) label = chalk.green('Excellent — well optimized');
  else if (score >= 75) label = chalk.green('Good — minor improvements available');
  else if (score >= 50) label = chalk.yellow('Fair — significant token waste detected');
  else label = chalk.red('Poor — major optimizations needed');

  console.log(`  ${label}`);

  if (issues.length > 0) {
    const highCount = issues.filter((i) => i.severity === 'HIGH').length;
    const medCount = issues.filter((i) => i.severity === 'MEDIUM').length;
    const lowCount = issues.filter((i) => i.severity === 'LOW').length;
    const details: string[] = [];
    if (highCount > 0) details.push(`${highCount}×HIGH (−${highCount * 15}pts)`);
    if (medCount > 0) details.push(`${medCount}×MEDIUM (−${medCount * 8}pts)`);
    if (lowCount > 0) details.push(`${lowCount}×LOW (−${lowCount * 3}pts)`);
    console.log(chalk.dim(`  Deductions: ${details.join(', ')}`));
  }
}

export function display(message: string): void {
  console.log(message);
}

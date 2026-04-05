import chalk from 'chalk';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Issue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  impact: string;
  fix: string;
}

export interface DailyStat {
  date: string;
  sessions: number;
  tokens?: number;
}

export interface ProjectStat {
  name: string;
  sessions: number;
  tokens?: number;
}

export interface Stats {
  totalSessions: number;
  totalTokens?: number;
  dailyStats: DailyStat[];
  projectStats: ProjectStat[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INDENT = '  ';

// ─── Banner & basic formatters ────────────────────────────────────────────────

export function printBanner(): void {
  const title = '⚡ Claude Token Saver (cts)';
  const inner = `  ${title}  `;
  const border = '─'.repeat(inner.length);
  console.log(chalk.cyan(`╭${border}╮`));
  console.log(chalk.cyan(`│${inner}│`));
  console.log(chalk.cyan(`╰${border}╯`));
}

export function printSuccess(msg: string): void {
  console.log(`${INDENT}${chalk.green('✔')} ${msg}`);
}

export function printWarning(msg: string): void {
  console.log(`${INDENT}${chalk.yellow('⚠')} ${msg}`);
}

export function printError(msg: string): void {
  console.log(`${INDENT}${chalk.red('✖')} ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`${INDENT}${chalk.blue('ℹ')} ${msg}`);
}

export function printDivider(): void {
  console.log(chalk.dim(`${INDENT}${'─'.repeat(50)}`));
}

// ─── Audit display ────────────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<Issue['severity'], string> = {
  critical: chalk.red('✖'),
  warning: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
};

const SEVERITY_ORDER: Issue['severity'][] = ['critical', 'warning', 'info'];

export function printIssues(issues: Issue[]): void {
  if (issues.length === 0) {
    printSuccess('No issues found');
    return;
  }

  for (const severity of SEVERITY_ORDER) {
    const group = issues.filter((i) => i.severity === severity);
    if (group.length === 0) continue;

    const label = severity.charAt(0).toUpperCase() + severity.slice(1);
    console.log(`\n${INDENT}${chalk.bold(label)} (${group.length})`);

    for (const issue of group) {
      console.log(`${INDENT}  ${SEVERITY_ICONS[severity]} ${issue.message}`);
      console.log(`${INDENT}     ${chalk.dim('Impact:')} ${issue.impact}`);
      console.log(`${INDENT}     ${chalk.dim('Fix:')}    ${issue.fix}`);
    }
  }
}

export function printScore(issues: Issue[]): void {
  const criticals = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  const score = Math.max(0, 100 - criticals * 25 - warnings * 10 - infos * 3);

  let label: string;
  let colorFn: (s: string) => string;
  if (score >= 90) {
    label = 'Excellent';
    colorFn = chalk.green;
  } else if (score >= 70) {
    label = 'Good';
    colorFn = chalk.cyan;
  } else if (score >= 50) {
    label = 'Fair';
    colorFn = chalk.yellow;
  } else {
    label = 'Needs Work';
    colorFn = chalk.red;
  }

  const barWidth = 20;
  const filled = Math.round((score / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));

  console.log(`\n${INDENT}Score: ${colorFn(`${score}/100`)} — ${colorFn(label)}`);
  console.log(`${INDENT}[${bar}]`);
}

// ─── Token tracker display ────────────────────────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  } else if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function trendIndicator(dailyStats: DailyStat[]): string {
  if (dailyStats.length < 2) return '➡️';
  const recent = dailyStats.slice(-3);
  const older = dailyStats.slice(-6, -3);
  if (older.length === 0) return '➡️';

  const recentAvg = recent.reduce((s, d) => s + d.sessions, 0) / recent.length;
  const olderAvg = older.reduce((s, d) => s + d.sessions, 0) / older.length;

  if (recentAvg > olderAvg * 1.1) return '📈';
  if (recentAvg < olderAvg * 0.9) return '📉';
  return '➡️';
}

function asciiBarChart(dailyStats: DailyStat[]): string[] {
  if (dailyStats.length === 0) return [`${INDENT}  No data available`];

  const BAR_HEIGHT = 5;
  const maxSessions = Math.max(...dailyStats.map((d) => d.sessions), 1);
  const lines: string[] = [];

  for (let row = BAR_HEIGHT; row >= 1; row--) {
    const threshold = (row / BAR_HEIGHT) * maxSessions;
    const bars = dailyStats
      .map((d) => (d.sessions >= threshold ? chalk.cyan('█') : chalk.dim(' ')))
      .join(' ');
    lines.push(`${INDENT}  ${bars}`);
  }

  const labels = dailyStats.map((d) => d.date.slice(-2)).join(' ');
  lines.push(`${INDENT}  ${chalk.dim(labels)}`);

  return lines;
}

export function printStats(stats: Stats, days: number): void {
  const { totalSessions, totalTokens, dailyStats, projectStats } = stats;

  console.log(`\n${INDENT}${chalk.bold('Token Usage Dashboard')} — last ${days} days`);
  printDivider();

  // Summary
  const trend = trendIndicator(dailyStats);
  console.log(`${INDENT}Sessions: ${chalk.cyan(String(totalSessions))} ${trend}`);
  if (totalTokens !== undefined) {
    console.log(`${INDENT}Tokens:   ${chalk.cyan(formatTokens(totalTokens))}`);
  }

  // Daily chart
  if (dailyStats.length > 0) {
    console.log(`\n${INDENT}${chalk.bold('Daily Activity')}`);
    for (const line of asciiBarChart(dailyStats)) {
      console.log(line);
    }
  } else {
    printInfo('No daily data available');
  }

  // Project breakdown
  if (projectStats.length > 0) {
    console.log(`\n${INDENT}${chalk.bold('Projects')}`);
    const maxName = Math.max(...projectStats.map((p) => p.name.length), 7);
    console.log(
      `${INDENT}  ${chalk.dim('Project'.padEnd(maxName))}  ${chalk.dim('Sessions')}`
    );
    printDivider();
    for (const p of projectStats) {
      const sessions = String(p.sessions).padStart(8);
      console.log(`${INDENT}  ${p.name.padEnd(maxName)}  ${chalk.cyan(sessions)}`);
    }
  } else {
    printInfo('No project data available');
  }

  // Smart tips
  console.log(`\n${INDENT}${chalk.bold('Tips')}`);
  if (totalSessions === 0) {
    printInfo('Start a session to begin tracking token usage');
  } else if (projectStats.length === 1) {
    printInfo('Use cts track to monitor usage across multiple projects');
  } else if (projectStats.length > 1) {
    const topProject = [...projectStats].sort((a, b) => b.sessions - a.sessions)[0];
    printInfo(`Most active project: ${chalk.cyan(topProject.name)}`);
  }
}

// ─── Legacy export ────────────────────────────────────────────────────────────

export function display(message: string): void {
  console.log(message);
}

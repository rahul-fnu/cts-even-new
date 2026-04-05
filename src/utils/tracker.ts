import fs from 'fs';
import path from 'path';
import { getDataDir } from './docker.js';

export interface Session {
  timestamp: string;
  project: string;
  tokens?: number;
  note?: string;
  [key: string]: unknown;
}

export interface TrackingData {
  sessions: Session[];
}

export interface DayStat {
  date: string;
  tokens: number;
  sessions: number;
}

export interface Stats {
  days: DayStat[];
  avgTokens: number;
  trend: 'up' | 'down' | 'stable';
  projects: string[];
  totalSessions: number;
  totalTokens: number;
}

export function getTrackingFilePath(): string {
  return path.join(getDataDir(), 'tracking.json');
}

export function loadTrackingFile(filePath: string): TrackingData {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as TrackingData;
  } catch {
    return { sessions: [] };
  }
}

export function saveTrackingFile(filePath: string, data: TrackingData): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function mergeTrackingFiles(
  primaryPath: string,
  sourcePath: string
): { merged: number; duplicates: number } {
  const primary = loadTrackingFile(primaryPath);
  const source = loadTrackingFile(sourcePath);

  const existingKeys = new Set(
    primary.sessions.map((s) => `${s.timestamp}|${s.project}`)
  );

  let merged = 0;
  let duplicates = 0;

  for (const session of source.sessions) {
    const key = `${session.timestamp}|${session.project}`;
    if (existingKeys.has(key)) {
      duplicates++;
    } else {
      primary.sessions.push(session);
      existingKeys.add(key);
      merged++;
    }
  }

  saveTrackingFile(primaryPath, primary);
  return { merged, duplicates };
}

export function logSession(tokens: number, note?: string): void {
  const filePath = getTrackingFilePath();
  const data = loadTrackingFile(filePath);
  const project = process.cwd();
  const session: Session = {
    timestamp: new Date().toISOString(),
    project,
    tokens,
  };
  if (note) session.note = note;
  data.sessions.push(session);
  saveTrackingFile(filePath, data);
}

export function clearData(): void {
  const filePath = getTrackingFilePath();
  saveTrackingFile(filePath, { sessions: [] });
}

export function exportCsv(): string {
  const filePath = getTrackingFilePath();
  const data = loadTrackingFile(filePath);
  const lines: string[] = ['timestamp,project,tokens,note'];
  for (const s of data.sessions) {
    const ts = s.timestamp;
    const project = `"${String(s.project).replace(/"/g, '""')}"`;
    const tokens = s.tokens ?? '';
    const note = s.note ? `"${String(s.note).replace(/"/g, '""')}"` : '';
    lines.push(`${ts},${project},${tokens},${note}`);
  }
  return lines.join('\n');
}

export function getStats(days: number): Stats {
  const filePath = getTrackingFilePath();
  const data = loadTrackingFile(filePath);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const recent = data.sessions.filter((s) => new Date(s.timestamp) >= cutoff);

  // Build per-day map
  const dayMap = new Map<string, { tokens: number; sessions: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { tokens: 0, sessions: 0 });
  }

  const projects = new Set<string>();
  let totalTokens = 0;

  for (const s of recent) {
    const key = s.timestamp.slice(0, 10);
    const entry = dayMap.get(key);
    const t = s.tokens ?? 0;
    if (entry) {
      entry.tokens += t;
      entry.sessions += 1;
    }
    projects.add(s.project);
    totalTokens += t;
  }

  const dayStats: DayStat[] = Array.from(dayMap.entries()).map(([date, v]) => ({
    date,
    tokens: v.tokens,
    sessions: v.sessions,
  }));

  const avgTokens = recent.length > 0 ? Math.round(totalTokens / recent.length) : 0;

  // Trend: compare first half vs second half of the window
  const half = Math.floor(dayStats.length / 2);
  const firstHalf = dayStats.slice(0, half).reduce((sum, d) => sum + d.tokens, 0);
  const secondHalf = dayStats.slice(half).reduce((sum, d) => sum + d.tokens, 0);
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (secondHalf > firstHalf * 1.1) trend = 'up';
  else if (secondHalf < firstHalf * 0.9) trend = 'down';

  return {
    days: dayStats,
    avgTokens,
    trend,
    projects: Array.from(projects),
    totalSessions: recent.length,
    totalTokens,
  };
}

export function printStats(stats: Stats): void {
  const { days, avgTokens, trend, projects, totalSessions, totalTokens } = stats;

  if (totalSessions === 0) {
    console.log('  No sessions logged yet. Use: cts track --log <tokens>');
    return;
  }

  // Bar chart
  const maxTokens = Math.max(...days.map((d) => d.tokens), 1);
  const barWidth = 20;

  console.log('  Daily Token Usage:');
  console.log('  ' + '─'.repeat(50));
  for (const day of days) {
    const filled = Math.round((day.tokens / maxTokens) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const label = day.date.slice(5); // MM-DD
    const count = day.tokens > 0 ? ` ${formatNumber(day.tokens)}` : '';
    console.log(`  ${label} │${bar}│${count}`);
  }
  console.log('  ' + '─'.repeat(50));

  // Summary
  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  console.log(`  Sessions : ${totalSessions}`);
  console.log(`  Total    : ${formatNumber(totalTokens)} tokens`);
  console.log(`  Avg/sess : ${formatNumber(avgTokens)} tokens`);
  console.log(`  Trend    : ${trendArrow} ${trend}`);
  console.log(`  Projects : ${projects.length}`);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function track(): void {
  // tracker utility
}

import fs from 'fs';
import path from 'path';
import { getDataDir } from './docker.js';

export interface SessionEntry {
  timestamp: string;   // ISO 8601
  tokens: number;
  project: string;     // defaults to basename of cwd
  note?: string;
  model?: string;
  duration?: number;   // seconds
}

// Legacy alias kept for compatibility
export type Session = SessionEntry;

export interface TrackingData {
  version: 1;
  sessions: SessionEntry[];
}

export interface UsageStats {
  totalTokens: number;
  totalSessions: number;
  avgTokensPerSession: number;
  maxTokensSession: SessionEntry | null;
  minTokensSession: SessionEntry | null;
  dailyBreakdown: Record<string, { tokens: number; sessions: number }>;
  projectBreakdown: Record<string, { tokens: number; sessions: number }>;
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
}

export function getDataFilePath(): string {
  return path.join(getDataDir(), 'tracking.json');
}

// Legacy alias
export const getTrackingFilePath = getDataFilePath;

export function loadData(): TrackingData {
  try {
    const raw = fs.readFileSync(getDataFilePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TrackingData>;
    return {
      version: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { version: 1, sessions: [] };
  }
}

export function saveData(data: TrackingData): void {
  const filePath = getDataFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function logSession(
  tokens: number,
  project?: string,
  note?: string,
  model?: string,
  duration?: number
): SessionEntry {
  const entry: SessionEntry = {
    timestamp: new Date().toISOString(),
    tokens,
    project: project ?? path.basename(process.cwd()),
    ...(note !== undefined && { note }),
    ...(model !== undefined && { model }),
    ...(duration !== undefined && { duration }),
  };

  const data = loadData();
  data.sessions.push(entry);
  saveData(data);

  return entry;
}

export function clearData(): void {
  saveData({ version: 1, sessions: [] });
}

export function getStats(days = 7): UsageStats {
  const data = loadData();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const sessions = data.sessions.filter(
    (s) => new Date(s.timestamp) >= cutoff
  );

  const totalTokens = sessions.reduce((sum, s) => sum + s.tokens, 0);
  const totalSessions = sessions.length;
  const avgTokensPerSession = totalSessions > 0 ? totalTokens / totalSessions : 0;

  let maxTokensSession: SessionEntry | null = null;
  let minTokensSession: SessionEntry | null = null;

  for (const s of sessions) {
    if (maxTokensSession === null || s.tokens > maxTokensSession.tokens) {
      maxTokensSession = s;
    }
    if (minTokensSession === null || s.tokens < minTokensSession.tokens) {
      minTokensSession = s;
    }
  }

  const dailyBreakdown: Record<string, { tokens: number; sessions: number }> = {};
  const projectBreakdown: Record<string, { tokens: number; sessions: number }> = {};

  for (const s of sessions) {
    const day = s.timestamp.slice(0, 10); // YYYY-MM-DD
    if (!dailyBreakdown[day]) dailyBreakdown[day] = { tokens: 0, sessions: 0 };
    dailyBreakdown[day].tokens += s.tokens;
    dailyBreakdown[day].sessions += 1;

    const proj = s.project;
    if (!projectBreakdown[proj]) projectBreakdown[proj] = { tokens: 0, sessions: 0 };
    projectBreakdown[proj].tokens += s.tokens;
    projectBreakdown[proj].sessions += 1;
  }

  // Trend: compare avg of first half vs second half
  let trend: 'up' | 'down' | 'flat' = 'flat';
  let trendPct = 0;

  if (sessions.length >= 2) {
    const mid = Math.floor(sessions.length / 2);
    const firstHalf = sessions.slice(0, mid);
    const secondHalf = sessions.slice(mid);

    const firstAvg = firstHalf.reduce((sum, s) => sum + s.tokens, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + s.tokens, 0) / secondHalf.length;

    if (firstAvg > 0) {
      trendPct = ((secondAvg - firstAvg) / firstAvg) * 100;
    }

    if (trendPct > 5) trend = 'up';
    else if (trendPct < -5) trend = 'down';
  }

  return {
    totalTokens,
    totalSessions,
    avgTokensPerSession,
    maxTokensSession,
    minTokensSession,
    dailyBreakdown,
    projectBreakdown,
    trend,
    trendPct,
  };
}

export function exportCsv(): string {
  const data = loadData();
  const header = 'timestamp,tokens,project,note,model,duration';
  const rows = data.sessions.map((s) => {
    const note = s.note !== undefined ? `"${s.note.replace(/"/g, '""')}"` : '';
    const model = s.model ?? '';
    const duration = s.duration !== undefined ? String(s.duration) : '';
    return `${s.timestamp},${s.tokens},"${s.project}",${note},${model},${duration}`;
  });
  return [header, ...rows].join('\n');
}

// Legacy helpers kept for compatibility with track.ts merge command
export function loadTrackingFile(filePath: string): TrackingData {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<TrackingData>;
    return {
      version: 1,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { version: 1, sessions: [] };
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

export function track(): void {
  // tracker utility
}

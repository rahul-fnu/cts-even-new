import fs from 'fs';
import path from 'path';
import { getDataDir } from './docker.js';

export interface Session {
  timestamp: string;
  project: string;
  [key: string]: unknown;
}

export interface TrackingData {
  sessions: Session[];
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

export function track(): void {
  // tracker utility
}
